# AMANA: Integration (what is mocked)

| Piece | Prototype | Real connection needs |
|---|---|---|
| National-ID sign-in | `services/adapters/mock-signin` (OIDC-shaped, synthetic personas); the demo API checks its signed ID token before delivering a result | set `SIGNIN_ISSUER` and provider keys; token format change to real JWT |
| Health-records exchange | `records-exchange` returns a signed FHIR Bundle (R5 via `fhir.resources`) | the exchange's endpoint, auth and profile; FHIR server not built |
| Labs | one `LabIssuer` per lab, keys registered with the token service | lab onboarding and key ceremony |
| National key | random per process in dev | Azure Key Vault (not provisioned) |
