### Simple webrtc p2p demo
- Simple webrtc p2p demo.  
- Only test on chrome.   
- Support https.  
- Socket.io. 
- Only support two user.

### Install
> npm install

### Run
> node server.js 
> https://localhost:3011/

### Other
> you can change localhost to your public IP

### Ref
> 本地延迟约172毫秒
> 考虑到用户传输延迟，及SFU处理延迟， SFU模式下p2p延迟预计约300ms+
  ![Alt text](https://github.com/jaygno/webrtc-demo/blob/master/public/img/localhost_p2p_latency.png)
