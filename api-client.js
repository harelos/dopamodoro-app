(function(global){
  const CFG_KEY = 'dopamodoro_api_config_v2';
  function getConfig(){
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {baseUrl:'',token:''}; }
    catch { return {baseUrl:'',token:''}; }
  }
  function setConfig(config){ localStorage.setItem(CFG_KEY, JSON.stringify(config)); }
  async function request(path, options={}){
    const cfg = getConfig();
    if(!cfg.baseUrl) throw new Error('API base URL is not configured');
    const headers = {'Content-Type':'application/json', ...(options.headers||{})};
    if(cfg.token) headers.Authorization = `Bearer ${cfg.token}`;
    const res = await fetch(cfg.baseUrl.replace(/\/$/,'') + path, {...options, headers});
    if(!res.ok){ const text = await res.text(); throw new Error(text || `API ${res.status}`); }
    if(res.status === 204) return null;
    return res.json();
  }
  const client = {
    getConfig,setConfig,request,
    listTasks:()=>request('/tasks'),
    createTask:(task)=>request('/tasks',{method:'POST',body:JSON.stringify(task)}),
    updateTask:(id,patch)=>request(`/tasks/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(patch)}),
    deleteTask:(id)=>request(`/tasks/${encodeURIComponent(id)}`,{method:'DELETE'}),
    getNorthStar:()=>request('/north-star'),
    saveNorthStar:(goal)=>request('/north-star',{method:'PUT',body:JSON.stringify(goal)}),
    sync:(payload)=>request('/sync',{method:'POST',body:JSON.stringify(payload)}),
    coach:(payload)=>request('/coach',{method:'POST',body:JSON.stringify(payload)})
  };
  global.DopamodoroAPI = client;
})(window);
