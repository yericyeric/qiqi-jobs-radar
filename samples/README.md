# Import samples

`jobs.demo.json` and `organization.demo.json` are complete, fictional examples. They can be loaded into the public demo. The authenticated live API rejects records marked demo. To create real imports, use the structure but replace every example field with sourced facts. Do not simply remove the demo flag from fictional data.

`candidate.json` contains only the education and experience supplied in the brief. No language, employer, experience year, certification or software skill is inferred.

For a real job with unknown status, set `verification: null`. Leave original and estimated posting dates null if unknown. Optional salary, apply URL, careers URL, public contact fields and size source can be empty strings; unknown company size must be `Unknown`.

The organization `lastCheckedForJobs` field is optional and refers to your manual check of its current openings. A directory entry alone is not evidence that no openings exist.
