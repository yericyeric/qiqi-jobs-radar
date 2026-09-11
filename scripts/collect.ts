import { collect } from "./collect-jobs";
void collect(process.argv[2], process.argv[3]).catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
