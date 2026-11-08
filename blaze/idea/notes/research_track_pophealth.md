# Track: population-health prior art (agent, 2026-11-03). [O]=opened [S]=snippet
## P2 prior art
- Inflo Health https://www.inflohealth.com/ [O] T2 — findings→owner→outreach→escalation, Epic/Cerner. Gap: US, imaging/incidental, single system, no Arabic.
- Eon https://eonhealth.com/ [O] T2 — radiology NLP incidental tracking; cites ~70% inappropriate follow-up (vendor claim). Gap: radiology-only, US.
- Ferrum Health https://ferrumhealth.com/ [O] — AI governance, not loop closure.
- NHS cervical screening failsafe guidance https://gov.uk/government/publications/cervical-screening-cytology-reporting-failsafe/cervical-screening-failsafe-guidance [O] T1 — role duties, 6wk/3mo timers, ≥6mo open failsafe; reference state-machine design.
## P4 prior art
- Kenzen https://kenzen.com/ [O] T2 wearable, enterprise. SlateSafety [S] T3. Epicore https://epicorebiosystems.com/ [O] T2 hydration.
- OSHA-NIOSH Heat Safety Tool https://osha.gov/heat/heat-app [O] T1 — heat index only.
- HRW 2025 https://www.hrw.org/news/2025/06/01/gulf-states-protect-workers-extreme-heat [O] T2 — 51.6°C Dubai in May before ban; recommends WBGT/workload-based rules.
## P5 prior art
- Cognetivity ICA PMC6355897 [O] T1 — culture-independence untested; no Arabic validation. Linus Health, BrainCheck [O] T2; Cognivue GUDID [O] T1.
## Building blocks
- pythermalcomfort phs() ISO 7933 [O] https://pythermalcomfort.readthedocs.io/en/stable/_modules/pythermalcomfort/models/phs.html
- Open-Meteo [O] https://open-meteo.com/en/pricing — free non-commercial 10k calls/day; data CC BY 4.0.
- HAPI FHIR Apache-2.0 [O] https://github.com/hapifhir/hapi-fhir ; Synthea Apache-2.0 [O] https://github.com/synthetichealth/synthea
- BiMediX (MBZUAI) CC-BY-NC-SA research only [O] https://github.com/mbzuai-oryx/BiMediX
## Evidence
- ILO Jul 2024: 83.6% Arab States workers exposed to excessive heat [O] T1 https://www.ilo.org/resource/news/more-workers-ever-are-losing-fight-against-heat-stress
- FairSquare Killer Heat 2023: ~10k S/SE Asian migrant worker deaths/yr in Gulf, >half unexplained [O] T2 https://fairsq.org/killer-heat/
- US safety-net FIT+: 42.3% no colonoscopy within 1 yr [O] T1 https://utsouthwestern.elsevierpure.com/en/publications/reasons-for-lack-of-diagnostic-colonoscopy-after-positive-result-
- Abu Dhabi Emiratis FIT+: only 30.5% had follow-up colonoscopy [S, blocked — VERIFY] https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8343888/
- Mammogram: 11% no follow-up at 1 yr [O] T1 https://pmc.ncbi.nlm.nih.gov/articles/PMC5648644
## Agent pick: P4 most demoable, P2 close second; P5 weakest; P3 unconvincing on synthetic.
