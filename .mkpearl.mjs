import { readFileSync, writeFileSync } from 'node:fs'
let html = readFileSync('dist/index.html', 'utf8')
const seed = `
<script type="module">
const FLAG='__pearl_v1'
if(localStorage.getItem(FLAG)!=='yes'){localStorage.setItem(FLAG,'yes')
const o=indexedDB.open('ai-companion-chat')
o.onupgradeneeded=()=>{const db=o.result
for(const [n,p] of [['characters',{keyPath:'id'}],['sessions',{keyPath:'id'}],['messages',{keyPath:'id'}],['memories',{keyPath:'id'}],['settings',{keyPath:'key'}],['promptPresets',{keyPath:'id'}]])if(!db.objectStoreNames.contains(n))db.createObjectStore(n,p)}
o.onsuccess=()=>{const db=o.result,now=Date.now()
const tx=db.transaction(['characters','sessions','messages'],'readwrite')
tx.objectStore('characters').put({id:'c1',name:'林晚',avatar:'',persona:'独立书店店主',style:'简短',addressUser:'你',selfName:'我',taboos:'',firstMessage:'来了。今天还是老样子？',exampleDialogs:'',scenario:'',tags:['温柔','日常'],createdAt:now-86400000*112,updatedAt:now})
tx.objectStore('sessions').put({id:'s1',characterId:'c1',title:'雨天的下午',lastMessageAt:now,createdAt:now-86400000*3})
const M=(id,role,text,extra)=>Object.assign({id,sessionId:'s1',role,content:text,type:'text',createdAt:now},extra)
tx.objectStore('messages').put(M('m1','user','今天有点累。',{createdAt:now-600000}))
tx.objectStore('messages').put(M('m2','assistant','那就别说话了，坐着。（把灯调暗了一格）书我给你留着，不急。',{createdAt:now-540000,meta:{reactions:{'❤️':now-500000}}}))
tx.objectStore('messages').put(M('m3','user','嗯。',{createdAt:now-300000}))
tx.objectStore('messages').put(M('m4','assistant','雨天看书最好了，我给你留了窗边那个位置。',{createdAt:now-240000}))
tx.oncomplete=()=>db.close()}
}
</script>`
html = html.replace('</head>', seed + '</head>')
html = html.replace('</head>', '<style>*,*::before,*::after{animation:none!important;transition:none!important}</style></head>')
writeFileSync('dist/__pearl.html', html.replaceAll('./assets/', '/assets/'), 'utf8')
console.log('wrote dist/__pearl.html')
