# Research baseline and launch gates

## Contract and holiday rules

The 2026-2028 discipline provides the legal baseline for vacation, suppressed-holiday allowances, permissions, sickness, and family leave. It describes a 36-hour standard week; the Florence office has confirmed that its operational full-time schedule is 37.5 hours. The portal therefore uses explicit ED work intervals and never calculates statutory accrual. HR must document the contractual basis for 37.5 hours before production launch.

- [2026-2028 employment discipline](https://www.fpcgil.it/wp-content/uploads/2026/03/Disciplina-Ambasciate-triennio-2026-28.pdf)
- [Italian working-time law](https://www.lavoro.gov.it/sites/default/files/documenti-e-norme/normative/Documents/2003/20030408_DLGS_66.pdf)
- [October 4 national holiday](https://www.normattiva.it/atto/caricaDettaglioAtto?atto.codiceRedazionale=25G00153&atto.dataPubblicazioneGazzetta=2025-10-10&tipoDettaglio=multivigenza)
- [Florence patron-saint observance](https://cultura.comune.fi.it/tradizioni-popolari/festivita-fiorentine/offerta-dei-ceri)

Good Friday is seeded as a centre closure at Easter minus two days. Easter Monday is a national holiday at Easter plus one day. October 4 is effective from 2026. These are database rules with effective dates and audited administrator overrides; they are not embedded in request handlers.

## Privacy

HR records only dates and absence type for sickness, Legge 104, and parental leave. There are no diagnosis, free-text medical-detail, or document fields. Technical logs and emails contain no absence type, dates, balance, or medical detail.

The department calendar is configured to show approved employee name and exact type under the organization's existing legal review. Visibility is type- and audience-configurable. HR/DPO must confirm the documented decision, retention periods, access review cadence, and processing record before launch.

- [Garante workplace-calendar guidance](https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/10268606)
- [GDPR data-minimization principle](https://eur-lex.europa.eu/legal-content/EN/AUTO/?uri=CELEX%3A32016R0679)

## External integration classification

Zucchetti product/API availability is contract-specific. CSV/XLSX import with preview, checksum idempotency, explicit cutoff, and reconciliation is the MVP interface. Obtain the exact product/version, field dictionary, sample exports, API terms, and future-absence inclusion semantics before considering a read-only connector.

INPS sickness attestations are technically available through employer services and PEC/XML, but require employer delegation plus legal, privacy, and security review. No public employer API was identified for parental leave or Legge 104. Sistema Tessera Sanitaria is not an employer source. Authenticated portal scraping and payroll write-back are prohibited.

- [INPS employer sickness-attestation service](https://www.inps.it/it/it/dettaglio-scheda.it.schede-servizio-strumento.schede-servizi.consultazione-degli-attestati-di-malattia-telematici.html)

## Deferred categories

Study leave, recoverable short permissions, bereavement, marriage, injury, maternity/paternity, union leave, treatment leave, and other categories remain disabled until HR defines eligibility, evidence, balance, visibility, and approval rules. No implementer should infer those rules from a label.
