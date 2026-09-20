export async function handleAPI(request){
 const url=new URL(request.url);const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
 if(url.pathname==='/api/status')return Response.json({configured:false,mode:'sites-login',signedIn:Boolean(request.headers.get('oai-authenticated-user-email'))},{headers});
 if(url.pathname==='/api/chat')return Response.json({error:'Percakapan tanpa API key tersedia melalui Dudidam Desktop dengan login ChatGPT. Login Sites hanya untuk akses situs.'},{status:409,headers});
 return Response.json({error:'Tidak ditemukan.'},{status:404,headers});
}
export default {async fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/'))return handleAPI(request);return env.ASSETS.fetch(request);}};
