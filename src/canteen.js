// Canteen: full menu, option picker, cart, ordering, and the "snack bag" the couple carries into the hall.
// Pure UI + state. The 3D counter lives in lobby.js, the wiring in main.js.
export const CUR='₹';                                   // change the currency symbol here

/* ------------------------------ menu data ------------------------------ */
// group: {id,name,multi,req,opts:[{n,p}]}  p = price added when picked.  item.vis = what you hold: popcorn | drink | ice | food
const G=(name,opts,{multi=0,req=0}={})=>({name,multi,req,opts:opts.map(o=>typeof o==='string'?{n:o,p:0}:{n:o[0],p:o[1]})});
const SIZE=(a=0,b=40,c=80)=>G('Size',[['Small',a],['Medium',b],['Large',c]],{req:1});
const ICE=G('Ice',['Regular ice','Less ice','No ice','Extra ice'],{req:1});
const SUGAR=G('Sugar',['Normal','Less sugar','No sugar','Extra sweet'],{req:1});
const DRINKS=['Cola','Lime Soda','Orange Fizz','Iced Tea','Cold Coffee','Mango Shake','Chocolate Shake','Strawberry Shake','Fresh Lime Juice','Mineral Water'];
const FLAV=G('Flavour',[['Salted',0],['Butter',0],['Caramel',10],['Cheese',10],['Peri-Peri',10],['Chocolate Drizzle',20]],{req:1});
const ICEFLAV=['Vanilla','Chocolate','Strawberry','Butterscotch','Mango','Choco Chip','Pistachio','Black Currant'];
const DIPS=G('Dips',[['Ketchup',0],['Mayo',0],['Cheese dip',15],['Garlic dip',10],['Salsa',10]],{multi:1});

export const CATS=[{id:'popcorn',name:'Popcorn',e:'🍿'},{id:'combo',name:'Couple Combos',e:'💑'},{id:'drinks',name:'Cold Drinks',e:'🥤'},{id:'hot',name:'Coffee & Tea',e:'☕'},{id:'ice',name:'Ice Cream',e:'🍦'},{id:'snacks',name:'Snacks & Meals',e:'🌭'},{id:'sweet',name:'Desserts & Sweets',e:'🍩'}];

const I=(cat,e,name,price,desc,groups=[],o={})=>({id:cat+':'+name,cat,e,name,price,desc,groups,vis:cat==='popcorn'?'popcorn':cat==='drinks'||cat==='hot'?'drink':cat==='ice'?'ice':'food',...o});
export const MENU=[
 I('popcorn','🍿','Popcorn',99,'Fresh popped, any flavour, any size',[FLAV,G('Size',[['Small',0],['Medium',50],['Large',100],['Sharing Tub',170]],{req:1}),G('Extras',[['Extra butter',20],['Extra cheese',25],['Caramel drizzle',25],['Mix two flavours',30]],{multi:1})],{veg:1}),
 I('popcorn','💗','Love Bucket (heart, reusable)',299,'Keepsake heart bucket with a refill of your flavour',[FLAV],{veg:1}),
 I('popcorn','🧀','Cheese Popcorn Boat',169,'Loaded with cheese powder and jalapeno',[G('Spice',['Mild','Medium','Hot'],{req:1}),G('Size',[['Regular',0],['Large',60]],{req:1})],{veg:1}),

 I('combo','💑','Couple Combo',399,'1 Large popcorn + 2 Medium drinks',[FLAV,G('Drink 1',DRINKS,{req:1}),G('Drink 2',DRINKS,{req:1}),ICE],{vis:'popcorn',veg:1,vis2:['popcorn','drink','drink']}),
 I('combo','🌙','Date Night Combo',599,'Large popcorn + 2 drinks + nachos + brownie',[FLAV,G('Drink 1',DRINKS,{req:1}),G('Drink 2',DRINKS,{req:1}),G('Nacho dip',['Cheese','Salsa','Jalapeno'],{req:1})],{vis2:['popcorn','drink','drink','food','food'],veg:1}),
 I('combo','💞','Sweetheart Combo',449,'Heart sundae for two + Medium popcorn + 2 drinks',[G('Sundae flavour',ICEFLAV,{req:1}),FLAV,G('Drink 1',DRINKS,{req:1}),G('Drink 2',DRINKS,{req:1})],{vis2:['ice','popcorn','drink','drink'],veg:1}),
 I('combo','🍔','Snack Feast Combo',649,'2 burgers + fries + 2 Medium drinks',[G('Burger',['Veg','Paneer','Chicken'],{req:1}),G('Fries',['Salted','Peri-Peri','Cheesy'],{req:1}),G('Drink 1',DRINKS,{req:1}),G('Drink 2',DRINKS,{req:1})],{vis2:['food','food','food','drink','drink']}),

 ...['Cola','Lime Soda','Orange Fizz','Iced Tea'].map(n=>I('drinks','🥤',n,59,'Ice cold, freshly poured',[SIZE(0,20,40),ICE,G('Extras',[['Lemon wedge',5],['Mint',5],['Ice cream scoop (float)',35]],{multi:1})],{veg:1})),
 ...['Cold Coffee','Mango Shake','Chocolate Shake','Strawberry Shake'].map(n=>I('drinks','🥛',n,119,'Thick and creamy',[SIZE(0,30,60),SUGAR,G('Extras',[['Whipped cream',20],['Ice cream scoop',35],['Choco syrup',15],['Extra shot',30]],{multi:1})],{veg:1})),
 I('drinks','🍋','Fresh Lime Juice',69,'Sweet, salted or mixed',[G('Style',['Sweet','Salted','Sweet & salted'],{req:1}),ICE],{veg:1}),
 I('drinks','💧','Mineral Water',30,'500 ml bottle',[G('Type',['Chilled','Room temperature'],{req:1})],{veg:1}),

 ...['Filter Coffee','Cappuccino','Latte','Hot Chocolate'].map(n=>I('hot','☕',n,89,'Served hot',[G('Size',[['Regular',0],['Large',30]],{req:1}),SUGAR,G('Milk',[['Regular',0],['Skimmed',0],['Soy',20],['Oat',30]],{req:1}),G('Extras',[['Extra shot',30],['Whipped cream',20],['Cinnamon',0],['Chocolate sprinkle',10]],{multi:1})],{veg:1})),
 ...['Masala Chai','Ginger Tea','Green Tea'].map(n=>I('hot','🍵',n,49,'Served hot',[G('Size',[['Regular',0],['Large',20]],{req:1}),SUGAR,G('Extras',[['Extra ginger',0],['Cardamom',5],['Lemon',5]],{multi:1})],{veg:1})),

 I('ice','🍦','Ice Cream',89,'Build your own: flavour, serve, scoops, toppings',[G('Flavour',ICEFLAV,{req:1}),G('Serve',[['Cup',0],['Cone',10],['Waffle cone',30]],{req:1}),G('Scoops',[['1 scoop',0],['2 scoops',40],['3 scoops',80]],{req:1}),G('Toppings',[['Choco syrup',15],['Sprinkles',10],['Nuts',20],['Caramel',15],['Cherry',10],['Brownie bits',25],['Whipped cream',15]],{multi:1})],{veg:1}),
 I('ice','💗','Couple Heart Sundae (for two)',349,'Heart-shaped bowl, two spoons, loads of toppings',[G('Flavour',ICEFLAV,{req:1}),G('Sauce',['Chocolate','Strawberry','Caramel','Butterscotch'],{req:1}),G('Extras',[['Brownie bits',25],['Nuts',20],['Cherry on top',10]],{multi:1})],{veg:1}),
 I('ice','🍨','Brownie Sundae',189,'Warm brownie, ice cream, hot fudge',[G('Flavour',ICEFLAV,{req:1}),G('Extras',[['Extra scoop',40],['Nuts',20]],{multi:1})],{veg:1}),
 I('ice','🥭','Kulfi',79,'Traditional stick kulfi',[G('Flavour',['Malai','Pista','Mango','Rabri'],{req:1})],{veg:1}),
 I('ice','🍫','Choco Bar',49,'Chocolate-coated ice cream bar',[G('Type',['Vanilla centre','Strawberry centre','Almond'],{req:1})],{veg:1}),

 I('snacks','🌮','Nachos',129,'Crispy chips with your dip',[G('Dip',[['Cheese',0],['Salsa',0],['Jalapeno cheese',15]],{req:1}),G('Size',[['Regular',0],['Large',60]],{req:1}),G('Extras',[['Extra cheese',25],['Jalapeno',10],['Beans',20],['Onion & corn',15]],{multi:1})],{veg:1}),
 I('snacks','🍟','French Fries',99,'Hot and crispy',[G('Seasoning',['Salted','Peri-Peri','Cheesy','Masala'],{req:1}),G('Size',[['Regular',0],['Large',50]],{req:1}),DIPS],{veg:1}),
 I('snacks','🥟','Samosa (2 pcs)',49,'Crispy potato samosas',[G('Chutney',['Green','Tamarind','Both'],{req:1})],{veg:1}),
 I('snacks','🥐','Veg Puff',39,'Flaky baked puff',[G('Serve',['Cold','Warmed'],{req:1})],{veg:1}),
 I('snacks','🌭','Hot Dog',119,'Toasted bun, grilled sausage',[G('Type',[['Veg',0],['Chicken',30]],{req:1}),G('Sauce',[['Mustard',0],['Ketchup',0],['Cheese',15],['Spicy mayo',10]],{multi:1})]),
 I('snacks','🍔','Burger',149,'Toasted bun, fresh patty',[G('Patty',[['Veg',0],['Paneer',20],['Chicken',30]],{req:1}),G('Extras',[['Cheese slice',20],['Extra patty',50],['Jalapeno',10],['Fried egg',20]],{multi:1})]),
 I('snacks','🍕','Pizza Slice',129,'Fresh from the oven',[G('Topping',[['Margherita',0],['Farmhouse',20],['Paneer Tikka',30],['Pepperoni',40]],{req:1}),G('Extras',[['Extra cheese',25],['Oregano & chilli flakes',0]],{multi:1})]),
 I('snacks','🥪','Grilled Sandwich',109,'Toasted with cheese',[G('Filling',[['Veg',0],['Cheese corn',20],['Chicken',40]],{req:1}),DIPS]),
 I('snacks','🍗','Chicken Nuggets',159,'Crunchy golden nuggets',[G('Pieces',[['6 pcs',0],['9 pcs',50]],{req:1}),G('Sauce',['Ketchup','Mayo','Peri-Peri','BBQ'],{multi:1})],{veg:0}),
 I('snacks','🥨','Soft Pretzel',89,'Warm and chewy',[G('Style',['Salted','Cinnamon sugar','Cheese stuffed'],{req:1})],{veg:1}),
 I('snacks','🥔','Chips & Dip',69,'Share-size chips',[G('Chips',['Salted','Masala','Cream & onion'],{req:1}),G('Dip',['Salsa','Cheese','Sour cream'],{req:1})],{veg:1}),

 I('sweet','🍫','Brownie',79,'Fudgy chocolate brownie',[G('Serve',[['Plain',0],['Warm + hot fudge',20],['With ice cream',45]],{req:1})],{veg:1}),
 I('sweet','🌋','Choco Lava Cake',99,'Molten chocolate centre',[G('Serve',[['Plain',0],['With ice cream',45]],{req:1})],{veg:1}),
 I('sweet','🍩','Donut',59,'Soft and glazed',[G('Flavour',['Glazed','Chocolate','Strawberry','Cinnamon'],{req:1}),G('Pieces',[['1',0],['2',50],['4',140]],{req:1})],{veg:1}),
 I('sweet','🥖','Churros',99,'Cinnamon churros with dip',[G('Dip',['Chocolate','Caramel','Strawberry'],{req:1}),G('Pieces',[['4 pcs',0],['8 pcs',70]],{req:1})],{veg:1}),
 I('sweet','🧇','Waffle',129,'Fresh waffle with toppings',[G('Topping',['Chocolate','Honey & butter','Strawberry','Maple'],{req:1}),G('Extras',[['Ice cream scoop',40],['Whipped cream',15],['Nuts',20]],{multi:1})],{veg:1}),
 I('sweet','🧁','Red Velvet Cupcake',79,'Cream-cheese frosting',[],{veg:1}),
 I('sweet','🍪','Cookies (3 pcs)',69,'Baked fresh today',[G('Type',['Choco chip','Oatmeal raisin','Double chocolate'],{req:1})],{veg:1}),
 I('sweet','🍬','Candy & Gummies',49,'Sweet share pack',[G('Type',['Gummy bears','Jelly hearts','Sour mix','Chocolate drops'],{req:1})],{veg:1}),
 I('sweet','🍭','Cotton Candy',59,'Spun fresh',[G('Colour',['Pink','Blue','Mixed'],{req:1})],{veg:1}),
 I('sweet','🍓','Fruit Cup',89,'Seasonal fresh fruit',[G('Extras',[['Chaat masala',0],['Honey drizzle',10],['Whipped cream',15]],{multi:1})],{veg:1})];

/* ------------------------------ UI ------------------------------ */
const money=n=>CUR+n,esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dot=v=>v===1?'<i class="vd v"></i>':v===0?'<i class="vd n"></i>':'';
let uid=1;

/** hooks: onOrder(order) when an order is placed (the seller starts working), onReady(order) when food is on the counter, onGift(lines) to send items to the partner, onBag({popcorn,drink}) when held items change,
    canGift() -> bool (partner is here), say(text) -> status line, sfx(name) */
export function createCanteen(h={}){
 let cat='popcorn',orderFor='me',open=false,cart=[],bag=[],view='menu',busy=false;
 const root=document.createElement('div');root.id='canteen';root.innerHTML=`<div class="cn-head"><b>🍿 TWIN CINEMA CANTEEN</b><span>Counter 1 · made fresh for the two of you</span><button class="cn-x" aria-label="Close">✕</button></div>
  <div class="cn-tabs"></div><div class="cn-body"></div><div class="cn-foot"></div><div class="cn-sheet"></div>`;document.body.appendChild(root);
 const $=s=>root.querySelector(s),tabs=$('.cn-tabs'),body=$('.cn-body'),foot=$('.cn-foot'),sheet=$('.cn-sheet');
 const bagBtn=document.createElement('button');bagBtn.id='bagbtn';bagBtn.style.display='none';document.body.appendChild(bagBtn);
 const bagPanel=document.createElement('div');bagPanel.id='bagpanel';document.body.appendChild(bagPanel);
 const toastEl=document.createElement('div');toastEl.id='toast';document.body.appendChild(toastEl);let tt;
 const toast=t=>{toastEl.textContent=t;toastEl.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>toastEl.classList.remove('on'),4200)};

 const total=()=>cart.reduce((a,l)=>a+l.unit*l.qty,0),count=()=>cart.reduce((a,l)=>a+l.qty,0);

 function renderTabs(){tabs.innerHTML=CATS.map(c=>`<button data-c="${c.id}" class="${c.id===cat?'on':''}"><span>${c.e}</span>${c.name}</button>`).join('');
  tabs.onclick=e=>{const b=e.target.closest('button');if(!b)return;cat=b.dataset.c;view='menu';render()}}
 function renderMenu(){body.innerHTML='<div class="cn-grid">'+MENU.filter(i=>i.cat===cat).map(i=>`<button class="cn-card" data-id="${esc(i.id)}"><div class="e">${i.e}</div><div class="t">${dot(i.veg)}${esc(i.name)}</div><div class="d">${esc(i.desc)}</div><div class="p">from ${money(i.price)}</div></button>`).join('')+'</div>';
  body.onclick=e=>{const b=e.target.closest('.cn-card');if(!b)return;openSheet(MENU.find(i=>i.id===b.dataset.id))}}

 /* option sheet for one item */
 function openSheet(item){const sel=item.groups.map(g=>new Set(g.req&&!g.multi?[0]:[]));let qty=1,note='';
  const unit=()=>item.price+item.groups.reduce((a,g,gi)=>a+[...sel[gi]].reduce((s,oi)=>s+g.opts[oi].p,0),0);
  const draw=()=>{sheet.innerHTML=`<div class="cn-sh"><div class="cn-sh-h"><div class="e">${item.e}</div><div><b>${dot(item.veg)}${esc(item.name)}</b><small>${esc(item.desc)}</small></div><button class="cn-x2">✕</button></div>
   <div class="cn-sh-b">${item.groups.map((g,gi)=>`<div class="grp"><h4>${esc(g.name)} <small>${g.multi?'pick any':g.req?'pick one':'optional'}</small></h4><div class="chips">${g.opts.map((o,oi)=>`<button class="chip ${sel[gi].has(oi)?'on':''}" data-g="${gi}" data-o="${oi}">${esc(o.n)}${o.p?` <em>+${money(o.p)}</em>`:''}</button>`).join('')}</div></div>`).join('')}
   <div class="grp"><h4>Special instructions <small>optional</small></h4><input class="cn-note" maxlength="60" placeholder="e.g. less spicy, extra napkins, for my love ♥" value="${esc(note)}"></div></div>
   <div class="cn-sh-f"><div class="qty"><button data-q="-1">−</button><b>${qty}</b><button data-q="1">+</button></div><button class="main add">Add to order · ${money(unit()*qty)}</button></div></div>`;
   const sh=sheet.firstElementChild;sh.onclick=e=>{const c=e.target.closest('.chip'),q=e.target.closest('[data-q]');
    if(c){const gi=+c.dataset.g,oi=+c.dataset.o,g=item.groups[gi],s=sel[gi];if(g.multi)s.has(oi)?s.delete(oi):s.add(oi);else if(g.req||!s.has(oi)){s.clear();s.add(oi)}else s.clear();draw()}
    else if(q){qty=Math.max(1,Math.min(20,qty+ +q.dataset.q));draw()}
    else if(e.target.closest('.cn-x2')){sheet.style.display='none'}
    else if(e.target.closest('.add')){const picks=item.groups.flatMap((g,gi)=>[...sel[gi]].map(oi=>g.opts[oi].n));addLine(item,picks,note,qty,unit());sheet.style.display='none'}};
   const ni=sh.querySelector('.cn-note');ni.oninput=()=>note=ni.value;ni.onkeydown=e=>e.stopPropagation()};
  draw();sheet.style.display='flex'}
 function addLine(item,picks,note,qty,unit){const key=item.id+'|'+picks.join(',')+'|'+note,ex=cart.find(l=>l.key===key);ex?ex.qty+=qty:cart.push({id:uid++,key,item,picks,note,qty,unit});h.sfx?.('add');render()}

 /* cart view */
 function renderCart(){const lines=cart.map(l=>`<div class="cn-line" data-id="${l.id}"><div class="e">${l.item.e}</div><div class="m"><b>${esc(l.item.name)}</b><small>${esc(l.picks.join(' · '))}${l.note?` · “${esc(l.note)}”`:''}</small></div><div class="qty"><button data-a="-">−</button><b>${l.qty}</b><button data-a="+">+</button></div><div class="lp">${money(l.unit*l.qty)}</div></div>`).join('');
  const gift=h.canGift?.();if(!gift&&orderFor!=='me')orderFor='me';
  body.innerHTML=`<div class="cn-cart"><h3>🛒 Your order</h3>${lines||'<p class="empty">Nothing here yet. Pick something tasty from the menu ♥</p>'}
   ${cart.length?`<div class="grp"><h4>Who is it for?</h4><div class="chips for"><button class="chip ${orderFor==='me'?'on':''}" data-f="me">🙋 Me</button><button class="chip ${orderFor==='partner'?'on':''}" data-f="partner" ${gift?'':'disabled'}>🎁 My love</button><button class="chip ${orderFor==='both'?'on':''}" data-f="both" ${gift?'':'disabled'}>💑 Both of us</button></div>${gift?'':'<small class="hint">Your partner is not in the lobby yet, so this order is for you.</small>'}</div>
   <div class="cn-sum"><span>Items</span><b>${count()}</b></div><div class="cn-sum big"><span>Total</span><b>${money(total())}</b></div>`:''}</div>`;
  body.onclick=e=>{const f=e.target.closest('[data-f]');if(f&&!f.disabled){orderFor=f.dataset.f;renderCart();renderFoot();return}
   const a=e.target.closest('[data-a]');if(a){const id=+a.closest('.cn-line').dataset.id,l=cart.find(x=>x.id===id);l.qty+=a.dataset.a==='+'?1:-1;if(l.qty<=0)cart=cart.filter(x=>x!==l);render()}}}

 function renderFoot(){const n=count();
  if(view==='cart')foot.innerHTML=`<button data-a="back">← Menu</button><button class="main" data-a="place" ${n&&!busy?'':'disabled'}>Place order · ${money(total())}</button>`;
  else foot.innerHTML=`<button class="main cartbtn" data-a="cart">🛒 ${n?`${n} item${n>1?'s':''} · ${money(total())} · View order`:'Your order is empty'}</button>`;
  foot.onclick=e=>{const a=e.target.closest('[data-a]')?.dataset.a;if(a==='cart'){view='cart';render()}else if(a==='back'){view='menu';render()}else if(a==='place')place()}}
 function render(){renderTabs();view==='cart'?renderCart():renderMenu();renderFoot();tabs.style.display=view==='cart'?'none':'flex'}

 /* placing the order: preparing -> ready on the counter */
 function place(){if(!cart.length||busy)return;busy=true;const order={code:String(100+Math.floor(Math.random()*900)),lines:cart,for:orderFor,total:total()};
  const mine=order.for!=='partner';
  body.innerHTML=`<div class="cn-prep"><div class="big">👩‍🍳</div><h3>Order #${order.code}</h3><p>Preparing your order…</p><div class="bar"><i></i></div></div>`;foot.innerHTML='';h.sfx?.('bell');h.onOrder?.(order);
  setTimeout(()=>{busy=false;const kinds=order.lines.flatMap(l=>Array(Math.min(3,l.qty)).fill(0).flatMap(()=>l.item.vis2||[l.item.vis]));
   cart=[];orderFor='me';view='menu';close();
   addBag(order.lines,mine);
   if(order.for!=='me')h.onGift?.(order.lines.map(l=>({name:l.item.name,e:l.item.e,vis:l.item.vis,vis2:l.item.vis2,picks:l.picks,qty:l.qty})));
   h.onReady?.(order,kinds,mine);toast(mine?`Order #${order.code} is ready on the counter ♥ Enjoy!`:`Order #${order.code} sent to your love 🎁`)},3200)}

 /* ---------- snack bag (what you carry) ---------- */
 const bagState=()=>({popcorn:bag.some(b=>b.vis==='popcorn'||b.vis2?.includes('popcorn')),drink:bag.some(b=>b.vis==='drink'||b.vis2?.includes('drink'))});
 function addBag(lines,mine){if(!mine)return;for(const l of lines){const it=l.item||l,name=it.name,key=name+'|'+(l.picks||[]).join(',');const ex=bag.find(b=>b.key===key);if(ex)ex.left+=l.qty;else bag.push({key,name,e:it.e,vis:it.vis,vis2:it.vis2,picks:l.picks||[],left:l.qty})}bagChanged()}
 function receive(items){for(const l of items){const key=l.name+'|'+(l.picks||[]).join(','),ex=bag.find(b=>b.key===key);if(ex)ex.left+=l.qty;else bag.push({key,name:l.name,e:l.e,vis:l.vis,vis2:l.vis2,picks:l.picks||[],left:l.qty})}bagChanged();toast('💝 Your partner treated you: '+items.map(l=>`${l.qty}× ${l.name}`).join(', '));h.sfx?.('gift')}
 function bagChanged(){const n=bag.reduce((a,b)=>a+b.left,0);bagBtn.textContent=`🧺 My snacks${n?` (${n})`:''}`;h.onBag?.(bagState());renderBag()}
 function renderBag(){bagPanel.innerHTML=`<div class="bp-h"><b>🧺 My snacks</b><button class="cn-x2">✕</button></div>`+(bag.length?bag.map((b,i)=>`<div class="bp-i"><span class="e">${b.e}</span><span class="m"><b>${esc(b.name)}</b><small>${esc(b.picks.slice(0,4).join(' · '))}</small></span><span class="k">×${b.left}</span><button data-i="${i}">😋 Enjoy</button></div>`).join(''):'<p class="empty">Nothing yet. Order from the canteen in the lobby ♥</p>');
  bagPanel.onclick=e=>{if(e.target.closest('.cn-x2')){bagPanel.style.display='none';return}const b=e.target.closest('button[data-i]');if(!b)return;const it=bag[+b.dataset.i];it.left--;h.sfx?.(it.vis==='drink'?'sip':it.vis==='popcorn'?'crunch':'bite');if(it.left<=0)bag.splice(+b.dataset.i,1);bagChanged();bagPanel.style.display='block'}}
 bagBtn.onclick=()=>{renderBag();bagPanel.style.display=bagPanel.style.display==='block'?'none':'block'};bagChanged();

 function openMenu(){if(open)return;open=true;view='menu';root.style.display='flex';render()}
 function close(){open=false;root.style.display='none';sheet.style.display='none';h.onClose?.()}
 $('.cn-x').onclick=()=>{if(!busy)close()};
 return{open:openMenu,close,get isOpen(){return open},receive,toast,showBag(on){bagBtn.style.display=on?'block':'none';if(!on)bagPanel.style.display='none'},get bagState(){return bagState()}}}
