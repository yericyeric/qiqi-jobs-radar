import { describe, it, expect, vi } from "vitest";
import { aiPayload, reviewFeed } from "../scripts/ai-review";
import { makeSample } from "../lib/sample";
import { feedSchema, mergeLiveFeed, emptyLiveState } from "../lib/live";
const now = Date.parse("2026-09-12T10:00:00Z");
function feed() {
  const input = structuredClone(makeSample(now).jobs[0]);
  input.isDemo = false; input.organization.isDemo = false;
  return feedSchema.parse({version:1, attemptedAt:new Date(now).toISOString(),lastSuccessfulAt:null,sources:[],jobs:[{id:"ats:test:1",board:"test",discoveredAt:new Date(now).toISOString(),input}]});
}
const opinion = {summary:"Production support experience can transfer to these event duties.",strengths:["Experience supporting live shows and stage operations."],questions:["Confirm the required availability and level of responsibility."],nextStep:"Review the employer requirements before applying."};
const response = () => new Response(JSON.stringify({status:"completed",steps:[{type:"model_output",content:[{type:"text",text:JSON.stringify(opinion)}]}]}), {status:200});
describe("optional anonymous AI second opinion", () => {
  it("accepts the provider output-block format without exposing thought blocks", async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({status:"completed",outputs:[{type:"thought",text:"not public"},{type:"text",text:JSON.stringify(opinion)}]}),{status:200}));
    const result = await reviewFeed(feed(),null,now,"test-secret",request);
    expect(result.aiReviews).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("not public");
  });
  it("sends only curated anonymous experience and sanitized vacancy fields", () => {
    const r = feed().jobs[0];
    r.input.description += " Contact private@example.com https://example.com Qiqi Su +1 305 555 1234";
    const payload = JSON.stringify(aiPayload(r));
    expect(payload).not.toMatch(/Qiqi|Yeric|3\.5 billion|private@example|https:\/\/|305 555/i);
    expect(Object.keys(aiPayload(r).vacancy)).toEqual(["title","location","description"]);
    expect(payload).toContain("Mandarin"); expect(payload).toContain("English");
  });
  it("has no API calls without a key", async () => {
    const request = vi.fn();
    const result = await reviewFeed(feed(),null,now,"",request);
    expect(request).not.toHaveBeenCalled(); expect(result.aiState?.status).toBe("needs_key");
  });
  it("caches unchanged reviews, rechecks changed duties and never changes scores", async () => {
    const input = feed(), request = vi.fn(async () => response());
    const reviewed = await reviewFeed(input,null,now,"test-secret",request);
    expect(reviewed.aiReviews).toHaveLength(1);
    expect(reviewed.jobs).toEqual(input.jobs);
    const before = mergeLiveFeed(emptyLiveState(),input,now);
    const after = mergeLiveFeed(emptyLiveState(),reviewed,now);
    expect(after.jobs[0].score).toEqual(before.jobs[0].score);
    expect(after.jobs[0].aiReview?.summary).toBe(opinion.summary);
    await reviewFeed(input,reviewed,now,"test-secret",request);
    expect(request).toHaveBeenCalledTimes(1);
    input.jobs[0].input.description += " New stage duties.";
    await reviewFeed(input,reviewed,now,"test-secret",request);
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("backs off on quota and preserves original matching", async () => {
    const input = feed(), request = vi.fn(async () => new Response("private error body",{status:429}));
    const result = await reviewFeed(input,null,now,"test-secret",request);
    expect(result.jobs).toEqual(input.jobs); expect(result.aiState?.status).toBe("quota");
    expect(JSON.stringify(result)).not.toContain("private error body");
    await reviewFeed(input,result,now+3600000,"test-secret",request);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("enforces daily limit and ignores instructions or malformed output", async () => {
    const input = feed(); input.aiState = {day:new Date(now).toISOString().slice(0,10),used:20,retryAfter:null,status:"ready",message:""};
    const request = vi.fn(async () => new Response(JSON.stringify({status:"completed",steps:[{type:"model_output",content:[{type:"text",text:'{"score":100,"applyUrl":"https://bad.example"}'}]}]}),{status:200}));
    await reviewFeed(input,input,now,"test-secret",request); expect(request).not.toHaveBeenCalled();
    const result = await reviewFeed(input,null,now,"test-secret",request);
    expect(result.aiReviews).toHaveLength(0); expect(result.jobs).toEqual(input.jobs);
    expect(result.aiState?.status).toBe("error");
  });
  it("does not send excluded or closed jobs", async () => {
    const input = feed(); input.jobs[0].input.title = "Warehouse worker";
    const request = vi.fn();
    await reviewFeed(input,null,now,"test-secret",request); expect(request).not.toHaveBeenCalled();
  });
});
