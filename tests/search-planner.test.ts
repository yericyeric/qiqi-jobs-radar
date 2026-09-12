import { describe,it,expect,vi } from "vitest";
import { planSearch } from "../scripts/search-planner";
import { updateQiqiSkills, sampleProfile } from "../lib/sample";
import { profileSchema } from "../lib/contracts";
const now = Date.parse("2026-09-12T00:00:00Z");
const key = "AIzaTEST_FAKE_KEY_FOR_UNIT_TESTS_ONLY";
const request = () => vi.fn(async () => new Response(JSON.stringify({candidates:[{finishReason:"STOP",content:{parts:[{text:JSON.stringify({query:"video editor"})}]}}]}),{status:200}));
describe("private scheduled search planning",()=>{
  it("calls once per six hours and alternates cities",async()=>{
    const send=request();
    const first=await planSearch(null,0,now,key,send);
    expect(first.plan.city).toBe("miami"); expect(first.plan.query).toBe("video editor");
    const cached=await planSearch(first.plan,0,now+3600000,key,send);
    expect(cached.due).toBe(false); expect(send).toHaveBeenCalledTimes(1);
    const next=await planSearch(first.plan,0,now+21600000,key,send);
    expect(next.plan.city).toBe("charleston"); expect(next.plan.query).not.toBe("video editor");
    expect(send).toHaveBeenCalledTimes(2);
    const body=JSON.stringify(send.mock.calls);
    expect(body).not.toMatch(/Qiqi Su|Yeric|3\.5 billion/);
  });
  it("keeps the four-call planning allowance and overall twenty-call limit",async()=>{
    const send=request(), first=await planSearch(null,0,now,undefined,send);
    await planSearch({...first.plan,used:4},0,now+21600000,key,send);
    await planSearch({...first.plan,used:1},19,now+21600000,key,send);
    expect(send).not.toHaveBeenCalled();
  });
  it("falls back to vetted role queries on invalid or unavailable output",async()=>{
    const send=vi.fn(async()=>new Response("",{status:503}));
    const result=await planSearch(null,0,now,key,send);
    expect(result.plan.query).toBeTruthy(); expect(result.plan.used).toBe(1);
    expect(result.due).toBe(true);
  });
  it("clears a previously saved name once and permits a blank name",()=>{
    const old={...sampleProfile,name:"Qiqi Su",namePrivacyVersion:undefined};
    const updated=updateQiqiSkills(old);
    expect(updated.name).toBe(""); expect(profileSchema.safeParse(updated).success).toBe(true);
    expect(updated.skills).toEqual(old.skills);
    expect(updateQiqiSkills(updated)).toBe(updated);
  });
});
