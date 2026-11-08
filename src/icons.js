import {createElement,Play,RotateCcw,LogOut,Cloud,FolderOpen,Mail,ArrowRight,ArrowLeft,Heart} from 'lucide';
/** Lucide icons for the app-style buttons. ic(icon) -> an <svg>; iconize(el,text) puts the text in el with a Lucide icon in front
    when the text starts with one of the old emoji / symbols (so existing labels keep working). */
export const ic=(icon,size=18,fill)=>{const s=createElement(icon,{width:size,height:size,'stroke-width':2,class:'lc'});if(fill)s.setAttribute('fill','currentColor');return s};
const MAP={'💌':Mail,'▶':Play,'🎞':FolderOpen,'☁️':Cloud,'↻':RotateCcw,'✕':LogOut,'←':ArrowLeft};
export function iconize(el,text){el.textContent='';const k=Object.keys(MAP).find(k=>text.startsWith(k));
 if(k){el.append(ic(MAP[k]),text.slice(k.length).trim())}else el.append(text);return el}
export {Play,RotateCcw,LogOut,Cloud,FolderOpen,Mail,ArrowRight,ArrowLeft,Heart};
