"""Build packs/abu-dhabi/panel-clinvar.csv from the ClinVar gene summary.

Gene list: autosomal-recessive conditions commonly in carrier screening, including
those frequent in Arab populations. Inheritance is curated here, not read from ClinVar.
Each gene is kept only if ClinVar lists it with >= MIN pathogenic/likely-pathogenic alleles.
"""
import csv
from pathlib import Path

AR = {
 "HBB":"beta-thalassaemia","HBA1":"alpha-thalassaemia","HBA2":"alpha-thalassaemia","CFTR":"cystic-fibrosis",
 "SMN1":"spinal-muscular-atrophy","GJB2":"hereditary-hearing-loss","SLC26A4":"pendred","PAH":"phenylketonuria",
 "MEFV":"familial-mediterranean-fever","HEXA":"tay-sachs","GBA1":"gaucher","ATP7B":"wilson",
 "BTD":"biotinidase-deficiency","ASS1":"citrullinemia","GALT":"galactosaemia","CYP21A2":"congenital-adrenal-hyperplasia",
 "ACADM":"mcad-deficiency","ASL":"argininosuccinic-aciduria","ASPA":"canavan","BCKDHA":"msud","BCKDHB":"msud","DBT":"msud",
 "BLM":"bloom-syndrome","CLN3":"batten","CLN5":"batten","CLN6":"batten","CPT2":"cpt2-deficiency","DHCR7":"smith-lemli-opitz",
 "FANCA":"fanconi-anaemia","FANCC":"fanconi-anaemia","FKTN":"walker-warburg","G6PC1":"glycogen-storage-1a","GAA":"pompe",
 "GALC":"krabbe","GCDH":"glutaric-aciduria-1","GLB1":"gm1-gangliosidosis","HEXB":"sandhoff","HGSNAT":"mps-3c",
 "HMGCL":"hmg-coa-lyase-deficiency","IDUA":"mps-1","IVD":"isovaleric-acidaemia","LDLR":"familial-hypercholesterolaemia-hom",
 "MCCC1":"mccc-deficiency","MCCC2":"mccc-deficiency","MLC1":"megalencephalic-leukoencephalopathy","MMACHC":"cblc",
 "MUT":"methylmalonic-acidaemia","MMUT":"methylmalonic-acidaemia","NBN":"nijmegen-breakage","NPC1":"niemann-pick-c","NPC2":"niemann-pick-c",
 "NPHS1":"nephrotic-syndrome-finnish","OTC":"otc-deficiency","PCCA":"propionic-acidaemia","PCCB":"propionic-acidaemia",
 "PEX1":"zellweger","PEX6":"zellweger","PKHD1":"arpkd","PMM2":"cdg-1a","POLG":"polg-disorders","PTS":"bh4-deficiency",
 "RARS2":"pontocerebellar-hypoplasia","SGSH":"mps-3a","SLC12A3":"gitelman","SLC17A5":"sialic-acid-storage",
 "SLC22A5":"carnitine-deficiency","SLC37A4":"glycogen-storage-1b","SMPD1":"niemann-pick-a-b","TTR":"ttr-amyloidosis",
 "TYR":"oculocutaneous-albinism-1","USH2A":"usher-2","VPS13B":"cohen","ABCC8":"congenital-hyperinsulinism",
 "ACADVL":"vlcad-deficiency","AGXT":"primary-hyperoxaluria-1","ALDOB":"hereditary-fructose-intolerance","BCS1L":"gracile",
 "CAPN3":"lgmd-2a","CHRNE":"congenital-myasthenic","COL27A1":"steel-syndrome","CRB1":"leber-congenital-amaurosis",
 "DYSF":"lgmd-2b","ETFDH":"mad-deficiency","FAH":"tyrosinaemia-1","FOXRED1":"complex-1-deficiency","GJB6":"hereditary-hearing-loss",
 "HADHA":"lchad-deficiency","HFE":"hemochromatosis","HSD17B4":"dbp-deficiency","LAMA2":"merosin-cmd","LIPA":"wolman",
 "MTHFR":"homocystinuria-mthfr","NEB":"nemaline-myopathy","OAT":"gyrate-atrophy","PC":"pyruvate-carboxylase-deficiency",
 "PDHB":"pdh-deficiency","PTPRC":"scid","RAG2":"scid","SACS":"arsacs","SGCA":"lgmd-2d","SGCB":"lgmd-2e","SGCG":"lgmd-2c",
 "STAR":"lipoid-cah","TAT":"tyrosinaemia-2","TF":"atransferrinaemia","TGM1":"lamellar-ichthyosis","TPP1":"batten",
 "TSFM":"combined-oxphos-deficiency","TYMP":"mngie","UROD":"porphyria-cutanea","WNK1":"pseudohypoaldosteronism","XPC":"xeroderma-pigmentosum",
}
MIN = 5
rows, dropped = [], []
src = Path("data/raw/gene_specific_summary.txt")
head = next(l for l in src.open() if l.startswith("#Symbol")).lstrip("#").rstrip("\n").split("\t")
stats = {}
for r in csv.DictReader((l for l in src.open() if not l.startswith("##")), delimiter="\t", fieldnames=head):
    if r["Symbol"].startswith("#"): continue
    stats[r["Symbol"]] = r
date = next(l for l in src.open()).split("dated")[1].strip()
for g, cond in AR.items():
    s = stats.get(g)
    n = int(s["Alleles_reported_Pathogenic_Likely_pathogenic"]) if s and s["Alleles_reported_Pathogenic_Likely_pathogenic"].isdigit() else 0
    (rows if n >= MIN else dropped).append((g, cond, n))
out = Path("packs/abu-dhabi/panel-clinvar.csv")
with out.open("w", newline="") as f:
    f.write(f"# panel_version: 2026.11-clinvar ({date})\n")
    w = csv.writer(f); w.writerow(["gene", "condition_code", "source", "clinvar_pathogenic_alleles"])
    for g, c, n in sorted(rows): w.writerow([g, c, "clinvar", n])
print(f"kept {len(rows)} genes, dropped {len(dropped)}: {[d[0] for d in dropped]}")

# Step 2: add the most common ClinVar condition name per gene (from variant_summary.txt.gz).
import collections
import gzip

keep = {g for g, _, _ in rows}
top = collections.defaultdict(collections.Counter)
with gzip.open("data/raw/variant_summary.txt.gz", "rt") as f:
    for row in csv.DictReader(f, delimiter="\t"):
        if row["Assembly"] != "GRCh38" or row["GeneSymbol"] not in keep: continue
        if row["ClinicalSignificance"] not in ("Pathogenic", "Likely pathogenic", "Pathogenic/Likely pathogenic"): continue
        for p in (x.strip() for x in row["PhenotypeList"].split("|")):
            if p and p.lower() not in ("not provided", "not specified"): top[row["GeneSymbol"]][p] += 1
with out.open("w", newline="") as f:
    f.write(f"# panel_version: 2026.11-clinvar ({date})\n")
    w = csv.writer(f); w.writerow(["gene", "condition_code", "source", "clinvar_pathogenic_alleles", "clinvar_top_condition"])
    for g, c, n in sorted(rows):
        t = top[g].most_common(1)
        w.writerow([g, c, "clinvar", n, t[0][0] if t else ""])
