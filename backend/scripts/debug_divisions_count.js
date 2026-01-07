const axios = require('axios');
async function run(){
  try{
    const res = await axios.get('http://localhost:5000/api/mysql-data/divisions?includeEmployeeCount=true');
    console.log('count:', res.data.count);
    console.log('sample:', JSON.stringify(res.data.data.slice(0,5), null, 2));
  }catch(e){console.error(e.response?.data || e.message)}
}
run();