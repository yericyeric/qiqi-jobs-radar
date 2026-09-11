# Broad-search validation — 2026-09-11

45 automated tests pass across eight files, including the career gate and sub-70 partial matches, unrelated-role rejection, remote restrictions, estimate provenance, monthly budget, missing-key status, independent source cadence, duplicate source attribution and retention on missing search results. Existing scoring, schema, auth, migration and transaction tests pass.

The live no-key portal run examined 1,218 records (18 Remotive, 200 Jobicy, 1,000 Himalayas), retaining 10 career-related possible fits before final browser filtering, alongside the direct employer feeds. This does not mean all ten are within the default 48-hour filter. No Google API request was made with a real key: that adapter was validated with mocked Google Jobs and organic-search responses. Activation still requires the user's GitHub secret and updated workflow.

ESLint, TypeScript and the optimized static build for /qiqi-jobs-radar pass. No private profile, notes or application history are put in the public feed. No automatic applications or messages were sent. The available GitHub browser is signed out; no changes have been pushed or deployed remotely. No browser interaction/screenshot QA is claimed.
