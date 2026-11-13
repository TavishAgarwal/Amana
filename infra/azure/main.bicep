// AMANA on Azure Container Apps, in a UAE region only (Federal Law 2/2019 Art. 13; docs/compliance.md L1).
// Nothing here has been deployed. Validate with: az bicep build -f infra/azure/main.bicep
// Deploy (costs money): az deployment group create -g <rg> -f infra/azure/main.bicep -p imageTag=<sha> acrName=<acr>
//
// What runs where:
//   wallet, console  external HTTPS        (console limited to counsellor networks by consoleAllowedCidrs)
//   relay            external HTTPS + WSS  ONE replica: sessions live in memory and both phones must reach
//                                          the same copy. Measured ~2,900 couples/s on one core (loadtest/).
//   api              internal only         demo API: sign-in, delivery, consents, counsellor desk
//   token            internal only         national token service; keys from Key Vault; 1-3 replicas
// No service stores genes. Logs go to Log Analytics with 30-day retention.

@description('Azure region. Only UAE regions are allowed, so health data stays in the country.')
@allowed(['uaenorth', 'uaecentral'])
param location string = 'uaenorth'

@description('Short prefix for resource names.')
@maxLength(12)
param prefix string = 'amana'

@description('Azure Container Registry that holds the images (name only).')
param acrName string

@description('Image tag to deploy, normally the git commit.')
param imageTag string

@description('Address ranges allowed to open the counsellor console. Empty allows all (demo only).')
param consoleAllowedCidrs array = []

@description('Optional: OpenAI-compatible endpoint for counsellor drafts. Empty turns server AI off.')
param llmUrl string = ''

@description('Keep wallet, relay and API running (no cold start for a demo). false lets them scale to zero, which is cheaper but loses the demo API state and adds a few seconds on first use.')
param alwaysOn bool = true
var minOn = alwaysOn ? 1 : 0

var tags = { app: 'amana', dataResidency: 'UAE' }

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' existing = {
  name: acrName
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30 }
}

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: '${prefix}-id'
  location: location
  tags: tags
}

// National keys and the lab registry. Put the secrets in after deployment (never in this file):
//   az keyvault secret set --vault-name <kv> -n national-master-key  --value <64 hex>
//   az keyvault secret set --vault-name <kv> -n national-signing-key --value <64 hex>
//   az keyvault secret set --vault-name <kv> -n lab-registry         --file labs.json
resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: '${prefix}-kv-${uniqueString(resourceGroup().id)}'
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enablePurgeProtection: true
    softDeleteRetentionInDays: 90
    publicNetworkAccess: 'Enabled'
  }
}

// Built-in roles: Key Vault Secrets User, AcrPull.
var kvSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var acrPull = '7f951dda-4ed3-4680-a7ca-43fe172d538d'

resource kvRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, identity.id, kvSecretsUser)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUser)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource acrRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identity.id, acrPull)
  scope: acr
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPull)
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

var registry = [{ server: acr.properties.loginServer, identity: identity.id }]
var acrServer = acr.properties.loginServer
var ids = { type: 'UserAssigned', userAssignedIdentities: { '${identity.id}': {} } }

resource token 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-token'
  location: location
  tags: tags
  identity: ids
  dependsOn: [kvRole, acrRole]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: false, targetPort: 8000, transport: 'http' }
      registries: registry
      secrets: [
        { name: 'national-master-key', keyVaultUrl: '${kv.properties.vaultUri}secrets/national-master-key', identity: identity.id }
        { name: 'national-signing-key', keyVaultUrl: '${kv.properties.vaultUri}secrets/national-signing-key', identity: identity.id }
        { name: 'lab-registry', keyVaultUrl: '${kv.properties.vaultUri}secrets/lab-registry', identity: identity.id }
      ]
    }
    template: {
      containers: [{
        name: 'token'
        image: '${acrServer}/amana-api:${imageTag}'
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'APP', value: 'token' }
          { name: 'PORT', value: '8000' }
          { name: 'AMANA_ENV', value: 'production' }
          { name: 'NATIONAL_MASTER_KEY', secretRef: 'national-master-key' }
          { name: 'NATIONAL_SIGNING_KEY', secretRef: 'national-signing-key' }
          { name: 'LAB_REGISTRY', value: '/secrets/lab-registry' }
        ]
        volumeMounts: [{ volumeName: 'secrets', mountPath: '/secrets' }]
        probes: [{ type: 'Liveness', httpGet: { path: '/healthz', port: 8000 } }]
      }]
      volumes: [{ name: 'secrets', storageType: 'Secret', secrets: [{ secretRef: 'lab-registry', path: 'lab-registry' }] }]
      // Rate limits are counted per copy, so 3 copies allow up to 3x the per-lab limit (docs/deployment-guide.md).
      scale: { minReplicas: 0, maxReplicas: 3 }
    }
  }
}

resource api 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-api'
  location: location
  tags: tags
  identity: ids
  dependsOn: [acrRole]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: false, targetPort: 8000, transport: 'http' }
      registries: registry
    }
    template: {
      containers: [{
        name: 'api'
        image: '${acrServer}/amana-api:${imageTag}'
        resources: { cpu: json('1.0'), memory: '2Gi' }
        env: [
          { name: 'APP', value: 'demo' }
          { name: 'AMANA_LLM_URL', value: llmUrl }
        ]
        probes: [{ type: 'Liveness', httpGet: { path: '/api/pack', port: 8000 } }]
      }]
      // The demo API keeps its state in memory: one copy only.
      scale: { minReplicas: minOn, maxReplicas: 1 }
    }
  }
}

resource relay 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-relay'
  location: location
  tags: tags
  identity: ids
  dependsOn: [acrRole]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 8080, transport: 'http', allowInsecure: false }
      registries: registry
    }
    template: {
      containers: [{
        name: 'relay'
        image: '${acrServer}/amana-relay:${imageTag}'
        resources: { cpu: json('0.5'), memory: '1Gi' }
        env: [
          { name: 'TRUST_PROXY', value: '1' }
          { name: 'RELAY_MAX_PER_MINUTE', value: '60' }
        ]
        probes: [{ type: 'Liveness', httpGet: { path: '/healthz', port: 8080 } }]
      }]
      scale: { minReplicas: minOn, maxReplicas: 1 }
    }
  }
}

var consoleRules = [for (cidr, i) in consoleAllowedCidrs: { name: 'allow-${i}', ipAddressRange: cidr, action: 'Allow' }]

resource wallet 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-wallet'
  location: location
  tags: tags
  identity: ids
  dependsOn: [acrRole]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: { external: true, targetPort: 3000, transport: 'http', allowInsecure: false }
      registries: registry
    }
    template: {
      containers: [{ name: 'wallet', image: '${acrServer}/amana-wallet:${imageTag}', resources: { cpu: json('0.5'), memory: '1Gi' } }]
      scale: { minReplicas: minOn, maxReplicas: 5 }
    }
  }
}

resource console 'Microsoft.App/containerApps@2024-03-01' = {
  name: '${prefix}-console'
  location: location
  tags: tags
  identity: ids
  dependsOn: [acrRole]
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
        allowInsecure: false
        ipSecurityRestrictions: consoleRules
      }
      registries: registry
    }
    template: {
      containers: [{ name: 'console', image: '${acrServer}/amana-console:${imageTag}', resources: { cpu: json('0.5'), memory: '1Gi' } }]
      scale: { minReplicas: 0, maxReplicas: 2 }
    }
  }
}

output walletUrl string = 'https://${wallet.properties.configuration.ingress.fqdn}'
output consoleUrl string = 'https://${console.properties.configuration.ingress.fqdn}'
output relayUrl string = 'wss://${relay.properties.configuration.ingress.fqdn}'
output apiInternalUrl string = 'http://${api.name}'
output keyVaultName string = kv.name
