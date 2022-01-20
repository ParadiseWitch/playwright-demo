import axios from "axios";
import Log from "./log";
const https = require('https');
const fs = require("fs");

// https://mirror77.mangafuna.xyz:12001/comic/hydxjxrwgb/94821/e0e9964c-c608-11e8-879b-024352452ce0.jpg!kb_w_read_large

const download = async (src, name) => {
  axios({
    method: 'get',
    url: src,
    responseType: 'stream',
    // FIXME 忽略SSL证书，不校验https证书，可能有风险
    httpsAgent: new https.Agent({
      rejectUnauthorized: false
    })
  }).then(res => {
    res.data.pipe(fs.createWriteStream(name));
  }).catch(err => Log.error(`${src} 文件下载失败!\n${err}`));
}
export default download;
