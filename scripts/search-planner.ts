import { anonymousCareer, planSchema, type SearchPlan } from "../lib/ai-review";
import { searchRoles } from "../lib/fit-skills";
import { sampleProfile } from "../lib/sample";

export async function planSearch(previous: SearchPlan | null, reviewUsage: number, now: number, key?: string, request: typeof fetch = fetch) {
  if (previous && now - Date.parse(previous.attemptedAt) < 6 * 3600000) return { plan: previous, due: false };
  const day = new Date(now).toISOString().slice(0,10);
  const used = previous?.day === day ? previous.used : 0;
  const city = previous?.city === "miami" ? "charleston" : "miami";
  // Select among vetted career-related titles, not arbitrary executable queries.
  const roles = searchRoles(sampleProfile);
  const recent = previous?.history || [];
  const choices = roles.filter(r => !recent.slice(-5).includes(r));
  let query = (choices.length ? choices : roles)[Math.floor(now / 21600000) % (choices.length || roles.length)];
  let spent = used;
  if (key && used < 4 && reviewUsage + used < 20) {
    spent++;
    try {
      const response = await request("https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent", {
        method:"POST", redirect:"error", signal:AbortSignal.timeout(30000),
        headers:{"Content-Type":"application/json","x-goog-api-key":key.trim()},
        body:JSON.stringify({
          systemInstruction:{parts:[{text:"Choose one job search title from the supplied choices for this anonymous professional background. Favor transferable skills, realistic assistant/coordinator opportunities and variety from recent searches. Return only JSON with a query field exactly equal to one choice. Do not identify the candidate or infer credentials. This chooses a search, not eligibility."}]},
          contents:[{role:"user",parts:[{text:JSON.stringify({candidate:anonymousCareer,city,choices:choices.length?choices:roles,recent})}]}],
          generationConfig:{maxOutputTokens:500,responseMimeType:"application/json",responseSchema:{type:"OBJECT",properties:{query:{type:"STRING"}},required:["query"]}},
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (candidate?.finishReason === "STOP") {
          const text = candidate.content?.parts?.filter((p:{thought?:boolean;text?:string})=>!p.thought).map((p:{text?:string})=>p.text||"").join("");
          const selected = JSON.parse(text).query;
          if ((choices.length?choices:roles).includes(selected)) query=selected;
        }
      }
    } catch { /* Deterministic career-related fallback; no private logging. */ }
  }
  return { due:true, plan:planSchema.parse({attemptedAt:new Date(now).toISOString(),city,query,history:[...recent,query].slice(-20),day,used:spent}) };
}
