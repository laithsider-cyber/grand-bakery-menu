const API='https://firestore.googleapis.com/v1/projects/grandbake-5689d/databases/(default)/documents/';
const state={categories:[],products:[],active:null,cart:new Map()};
const $=s=>document.querySelector(s);
const value=v=>v?.stringValue??Number(v?.integerValue??v?.doubleValue??0);
const parseDoc=d=>({id:d.name.split('/').pop(),...Object.fromEntries(Object.entries(d.fields||{}).map(([k,v])=>[k,value(v)]))});
const escapeHtml=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

async function getCollection(name){
  const cached=sessionStorage.getItem(`gb-${name}`);
  if(cached){const parsed=JSON.parse(cached);if(Date.now()-parsed.time<300000)return parsed.data}
  const response=await fetch(API+name);
  if(!response.ok)throw new Error('تعذر تحميل القائمة');
  const json=await response.json();
  const data=(json.documents||[]).map(parseDoc);
  sessionStorage.setItem(`gb-${name}`,JSON.stringify({time:Date.now(),data}));
  return data;
}

function renderCategories(){
  $('#status').hidden=true;$('#productsView').hidden=true;$('#categories').hidden=false;
  $('#categories').innerHTML=state.categories.map((cat,i)=>`<button class="category-card" data-category="${cat.id}"><img src="${escapeHtml(cat.img)}" alt="" loading="${i<4?'eager':'lazy'}" decoding="async"><span>${escapeHtml(cat.name)}</span></button>`).join('');
}

async function openCategory(id){
  state.active=id;const category=state.categories.find(c=>c.id===id);
  $('#categories').hidden=true;$('#productsView').hidden=false;$('#activeCategory').textContent=category?.name||'المنتجات';
  $('#products').innerHTML='<div class="status">جاري تحميل منتجات القسم…</div>';
  if(!state.products.length)state.products=await getCollection('menu');
  renderProducts(state.products.filter(p=>p.categoryId===id));window.scrollTo({top:$('#productsView').offsetTop-90,behavior:'smooth'});
}

function renderProducts(items){
  $('#products').innerHTML=items.length?items.map(item=>`<article class="product-card"><img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.nameAr)}" loading="lazy" decoding="async"><div class="product-info"><h3>${escapeHtml(item.nameAr)}</h3><div class="product-bottom"><span class="price">${Number(item.price).toFixed(2)} د.أ</span><button class="add-button" data-add="${item.id}" type="button">+ أضف</button></div></div></article>`).join(''):'<div class="status">لا توجد منتجات في هذا القسم حاليًا.</div>';
}

function addItem(id){const item=state.products.find(p=>p.id===id);if(!item)return;const existing=state.cart.get(id);state.cart.set(id,{...item,qty:(existing?.qty||0)+1});updateCart()}
function changeQty(id,delta){const item=state.cart.get(id);if(!item)return;item.qty+=delta;if(item.qty<=0)state.cart.delete(id);else state.cart.set(id,item);updateCart();renderCart()}
function totals(){const items=[...state.cart.values()];return{count:items.reduce((n,i)=>n+i.qty,0),total:items.reduce((n,i)=>n+Number(i.price)*i.qty,0)}}
function updateCart(){const {count,total}=totals();$('#cartBar').hidden=!count;$('#cartCount').textContent=count;$('#cartTotal').textContent=`${total.toFixed(2)} د.أ`;$('#dialogTotal').textContent=`${total.toFixed(2)} د.أ`}
function renderCart(){const items=[...state.cart.values()];$('#cartItems').innerHTML=items.map(i=>`<div class="cart-item"><div><strong>${escapeHtml(i.nameAr)}</strong><small>${Number(i.price).toFixed(2)} د.أ</small></div><div class="qty"><button data-qty="${i.id}" data-delta="-1">−</button><b>${i.qty}</b><button data-qty="${i.id}" data-delta="1">+</button></div><strong>${(Number(i.price)*i.qty).toFixed(2)}</strong></div>`).join('')}
function buildWhatsAppLink(){const method=document.querySelector('input[name="fulfillment"]:checked')?.value;if(!method){alert('اختار توصيل أو استلام من المخبز أولًا');return null}const address=$('#deliveryAddress').value.trim();if(method==='توصيل'&&!address){alert('اكتب عنوان التوصيل أولًا');$('#deliveryAddress').focus();return null}const {total}=totals();let message='مرحباً مخابز جراند، أود تأكيد الطلب التالي:\n\n';for(const i of state.cart.values())message+=`• ${i.nameAr} × ${i.qty} — ${(Number(i.price)*i.qty).toFixed(2)} د.أ\n`;message+=`\nالمجموع: ${total.toFixed(2)} د.أ\nطريقة الاستلام: ${method}`;if(address)message+=`\nعنوان التوصيل: ${address}`;const note=$('#orderNote').value.trim();if(note)message+=`\n\nملاحظات: ${note}`;return `https://wa.me/962792089999?text=${encodeURIComponent(message)}`}

$('#categories').addEventListener('click',e=>{const card=e.target.closest('[data-category]');if(card)openCategory(card.dataset.category).catch(showError)});
$('#products').addEventListener('click',e=>{const button=e.target.closest('[data-add]');if(button)addItem(button.dataset.add)});
$('#backButton').addEventListener('click',()=>{state.active=null;renderCategories();window.scrollTo({top:$('#menu-title').offsetTop-100,behavior:'smooth'})});
$('#openCart').addEventListener('click',()=>{renderCart();$('#cartDialog').showModal()});
$('#cartItems').addEventListener('click',e=>{const button=e.target.closest('[data-qty]');if(button)changeQty(button.dataset.qty,Number(button.dataset.delta))});
document.querySelectorAll('input[name="fulfillment"]').forEach(input=>input.addEventListener('change',()=>{$('#addressField').hidden=input.value!=='توصيل'||!input.checked}));
$('#whatsappButton').addEventListener('click',()=>{const link=buildWhatsAppLink();if(link)window.open(link,'_blank','noopener')});
$('#searchToggle').addEventListener('click',()=>{$('#searchBox').hidden=!$('#searchBox').hidden;if(!$('#searchBox').hidden)$('#searchInput').focus()});
$('#searchInput').addEventListener('input',async e=>{const q=e.target.value.trim().toLowerCase();if(!q){state.active?renderProducts(state.products.filter(p=>p.categoryId===state.active)):renderCategories();return}if(!state.products.length)state.products=await getCollection('menu');$('#categories').hidden=true;$('#productsView').hidden=false;$('#activeCategory').textContent='نتائج البحث';renderProducts(state.products.filter(p=>String(p.nameAr).toLowerCase().includes(q)))});
function showError(){ $('#status').hidden=false;$('#status').innerHTML='تعذر تحميل المنيو الآن. <button onclick="location.reload()">حاول مرة أخرى</button>' }

getCollection('categories').then(data=>{state.categories=data;renderCategories()}).catch(showError);
