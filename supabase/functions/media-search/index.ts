// Supabase Edge Function: media-search
// Deploy: supabase functions deploy media-search
// Secret: supabase secrets set TMDB_READ_ACCESS_TOKEN=...
// Requires an authenticated member_profiles.is_admin = true user.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = "https://looloosia.github.io";
function cors(origin:string|null) {
 return {
  "Access-Control-Allow-Origin": origin===allowedOrigin?origin:allowedOrigin,
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Vary":"Origin",
  "Content-Type":"application/json; charset=utf-8"
 };
}
function respond(status:number,payload:unknown,origin:string|null){
 return new Response(JSON.stringify(payload),{status,headers:cors(origin)});
}
serve(async req=>{
 const origin=req.headers.get("Origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors(origin)});
 if(req.method!=="POST")return respond(405,{error:"허용되지 않은 방식입니다."},origin);
 if(origin&&origin!==allowedOrigin)return respond(403,{error:"허용되지 않은 출처입니다."},origin);
 const bearer=req.headers.get("Authorization")||"";
 const token=bearer.startsWith("Bearer ")?bearer.slice(7):"";
 if(!token)return respond(401,{error:"로그인이 필요합니다."},origin);
 const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
 const pubKey=Deno.env.get("SUPABASE_PUBLISHABLE_KEY")||Deno.env.get("SUPABASE_ANON_KEY")||"";
 const tmdbToken=Deno.env.get("TMDB_READ_ACCESS_TOKEN")||"";
 if(!supabaseUrl||!pubKey||!tmdbToken)return respond(503,{error:"서버 연결 또는 TMDB 토큰이 설정되지 않았습니다."},origin);
 try{
  const sb=createClient(supabaseUrl,pubKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const userResult=await sb.auth.getUser(token);
  const user=userResult.data.user;
  if(userResult.error||!user)return respond(401,{error:"유효하지 않은 로그인입니다."},origin);
  const adminClient=createClient(supabaseUrl,pubKey,{
   global:{headers:{Authorization:"Bearer "+token}},
   auth:{autoRefreshToken:false,persistSession:false}
  });
  const profileResult=await adminClient.from("member_profiles").select("is_admin").eq("id",user.id).maybeSingle();
  if(profileResult.error||!profileResult.data?.is_admin)return respond(403,{error:"관리자만 검색할 수 있습니다."},origin);
  const payload=await req.json();
  const title=String(payload.title||"").trim().slice(0,100);
  const type=payload.kind==="드라마"?"tv":"movie";
  if(title.length<2)return respond(400,{error:"검색어는 두 글자 이상이어야 합니다."},origin);
  const endpoint=new URL("https://api.themoviedb.org/3/search/"+type);
  endpoint.searchParams.set("query",title);
  endpoint.searchParams.set("language","ko-KR");
  endpoint.searchParams.set("include_adult","false");
  const remote=await fetch(endpoint,{headers:{Authorization:"Bearer "+tmdbToken,Accept:"application/json"}});
  if(!remote.ok)return respond(502,{error:"TMDB 검색에 실패했습니다."},origin);
  const data=await remote.json();
  const results=(Array.isArray(data.results)?data.results:[]).filter((x:any)=>/^\/[a-zA-Z0-9/_-]+\.(jpg|png|webp)$/.test(String(x.poster_path||""))).slice(0,15).map((x:any)=>({
    title:String(x.title||x.name||"제목 없음"),
    posterUrl:"https://image.tmdb.org/t/p/w500"+x.poster_path,
    year:String(x.release_date||x.first_air_date||"").slice(0,4),
    source:"tmdb",
    sourceUrl:"https://www.themoviedb.org/"+type+"/"+x.id
  }));
  return respond(200,{results},origin);
 }catch(_e){return respond(500,{error:"검색 서버 오류입니다."},origin);}
});
