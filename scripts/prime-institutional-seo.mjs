// Offline policy shared by package and independent verifier. Production workflow remains NOINDEX.
import {companyRoutes} from "./company-routes.mjs";
export const institutionalIndexPages=Object.freeze(["index", "empresa",...companyRoutes,"comercios","repartidores","prime","contacto","confianza","noticias","talento","en"]);
const selected=new Set(institutionalIndexPages);
export const canonicalFor=name=>"https://desset.lat/"+(name==="index"?"":name);
export const expectedRobots=(name,policy)=>policy==="INDEX"&&selected.has(name)?"index,follow":"noindex,nofollow";
export function indexPage(html,name,policy){
 if(!["INDEX","NOINDEX"].includes(policy)||!selected.has(name))throw Error("NO-GO: unreviewed SEO route");
 const old='<meta name="robots" content="noindex,nofollow">';
 if(html.split(old).length!==2||!html.includes('<link rel="canonical" href="'+canonicalFor(name)+'">'))throw Error("NO-GO: SEO source differs "+name);
 return html.replace(old,'<meta name="robots" content="'+expectedRobots(name,policy)+'">');
}
export function institutionalSitemap(policy){
 if(!["INDEX","NOINDEX"].includes(policy))throw Error("NO-GO: invalid SEO policy");
 const urls=policy==="INDEX"?institutionalIndexPages.map(name=>"<url><loc>"+canonicalFor(name)+"</loc></url>").join(""):"";
 return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+urls+'</urlset>\n';
}
export function assertSeoPage(html,name,policy){
 const value=expectedRobots(name,policy);
 if((html.match(/<meta name="robots" content="[^"]+">/g)||[]).length!==1||!html.includes('<meta name="robots" content="'+value+'">')||!html.includes('<link rel="canonical" href="'+canonicalFor(name)+'">'))throw Error("NO-GO: canonical or indexing differs "+name);
}
