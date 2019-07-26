'use strict';

var pc1;
const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

const constraints = window.constraints = {
  video: { width: 320, height: 240, frameRate: 13},
  audio: true,
};
const constraints_video = window.constraints = {
  video: { width: 640, height: 480, frameRate: 15},
};

const configuration = {
      sdpSemantics: 'plan-b',
      iceTransportPolicy: 'all',
      iceServers:[
          {url: "turn:95.169.5.200:3478", username: "jaygno", credential: "R0RFAKAI8F"},
          {url: "stun:webcs.agora.io:3478"}
      ]
}

document.querySelector('#userid').value = randomString(9);

var socket=io.connect('10.1.137.146:3011');//与服务器进行连接
var joinBtn=document.getElementById('joinBtn');

const remoteVideo = document.getElementById('remote');

joinBtn.addEventListener('click', join);

//refer https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack

async function join() {
  joinBtn.disabled = true;
  var userId = document.querySelector('#userid').value;

  await getLocalMedia();
  await initPeer();

  socket.emit('join', userId);
}

async function getLocalMedia() {
  console.log('Requesting local stream');
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    console.log('Received local stream');
    const video = document.getElementById('local');
    video.srcObject = stream;
    video.autoplay = true;
    window.stream = stream;
  } catch (e) {
    alert(`getUserMedia() error: ${e.name}`);
  }
}

async function initPeer() {
  console.log('Starting call');
  const videoTracks = window.stream.getVideoTracks();
  const audioTracks = window.stream.getAudioTracks();
  if (videoTracks.length > 0) {
    console.log(`Using video device: ${videoTracks[0].label}`);
  }
  if (audioTracks.length > 0) {
    console.log(`Using audio device: ${audioTracks[0].label}`);
  }

  console.log('RTCPeerConnection configuration:', configuration);
  pc1 = new RTCPeerConnection(configuration);
  window.pc1 = pc1;  

  console.log('Created local peer connection object pc1');
  pc1.addEventListener('icecandidate', e => onIceCandidate(pc1, e));
  pc1.addEventListener('iceconnectionstatechange', e => onIceStateChange(pc1, e));
  pc1.addEventListener('negotiationneeded', e => { console.log(e); });
  pc1.addEventListener('icecandidateerror', e => {});
  pc1.addEventListener('signalingstatechange', e => {});
  pc1.addEventListener('iceconnectionstatechange', e => {});
  pc1.addEventListener('icegatheringstatechange', e => {});
  pc1.addEventListener('connectionstatechange', e => {});


  pc1.addEventListener('track', e => gotRemoteStream(e));
  window.stream.getTracks().forEach(track => pc1.addTrack(track, window.stream));
  console.log('Added local stream to pc1');
}


async function start() {
  try {
    console.log('pc1 createOffer start');
    const offer = await pc1.createOffer(offerOptions);
    offer.sdp = setBitrate(offer.sdp);
    //offer.sdp = delUlpfec(offer.sdp);
    console.log('pc1 setLocalDescription start', offer);
    await pc1.setLocalDescription(offer);
    socket.emit('offer', offer);
  } catch (e) {
    console.log(e);
  }
}

function gotRemoteStream(e) {
  if (remoteVideo.srcObject !== e.streams[0]) {
    remoteVideo.srcObject = e.streams[0];
    console.log('pc2 received remote stream');
  }
}

async function onIceCandidate(pc, event) {
    console.log('icecandidate', event.candidate);
    if (event.candidate !== null) {
        socket.emit('icecandidate', event.candidate);
    }
}

function onIceStateChange(pc, event) {
  if (pc) {
    console.log(`ICE state: ${pc.iceConnectionState}`);
    console.log('ICE state change event: ', event);
  }
}

socket.on('negotiationneeded', async function(msg) {
  await start();
})

socket.on('icecandidate',async function(msg){
    await pc1.addIceCandidate(msg);    
    console.log(msg);
})

socket.on('offer',async function(msg){
    console.log(msg);
    pc1.setRemoteDescription(msg);
    const answer = await pc1.createAnswer();
    await pc1.setLocalDescription(answer);
    socket.emit('answer', answer);
})
    
socket.on('answer',async function(msg){
    await pc1.setRemoteDescription(msg);
    console.log(msg);
})

function randomString(strLength) {
  var result = [];
  strLength = strLength || 5;
  var charSet = "0123456789";
  while (strLength--) {
    result.push(charSet.charAt(Math.floor(Math.random() * charSet.length)));
  }
  return result.join("");
}

var BandwidthHandler = (function() {
    function setBAS(sdp, bandwidth, isScreen) {
        if (!!navigator.mozGetUserMedia || !bandwidth) {
            return sdp;
        }

        if (isScreen) {
            if (!bandwidth.screen) {
                console.warn('It seems that you are not using bandwidth for screen. Screen sharing is expected to fail.');
            } else if (bandwidth.screen < 300) {
                console.warn('It seems that you are using wrong bandwidth value for screen. Screen sharing is expected to fail.');
            }
        }

        // if screen; must use at least 300kbs
        if (bandwidth.screen && isScreen) {
            sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
            sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + bandwidth.screen + '\r\n');
        }

        // remove existing bandwidth lines
        if (bandwidth.audio || bandwidth.video || bandwidth.data) {
            sdp = sdp.replace(/b=AS([^\r\n]+\r\n)/g, '');
        }

        if (bandwidth.audio) {
            sdp = sdp.replace(/a=mid:audio\r\n/g, 'a=mid:audio\r\nb=AS:' + bandwidth.audio + '\r\n');
        }

        if (bandwidth.video) {
            sdp = sdp.replace(/a=mid:video\r\n/g, 'a=mid:video\r\nb=AS:' + (isScreen ? bandwidth.screen : bandwidth.video) + '\r\n');
        }

        return sdp;
    }

    // Find the line in sdpLines that starts with |prefix|, and, if specified,
    // contains |substr| (case-insensitive search).
    function findLine(sdpLines, prefix, substr) {
        return findLineInRange(sdpLines, 0, -1, prefix, substr);
    }

    // Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
    // and, if specified, contains |substr| (case-insensitive search).
    function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
        var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
        for (var i = startLine; i < realEndLine; ++i) {
            if (sdpLines[i].indexOf(prefix) === 0) {
                if (!substr ||
                    sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
                    return i;
                }
            }
        }
        return null;
    }

    // Gets the codec payload type from an a=rtpmap:X line.
    function getCodecPayloadType(sdpLine) {
        var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
        var result = sdpLine.match(pattern);
        return (result && result.length === 2) ? result[1] : null;
    }

    function delVideoUlpfec(sdp, params) {
        //a=rtpmap:116 ulpfec/90000
        var sdpLines = sdp.split('\r\n');
        var ulpfecIndex = findLine(sdpLines, 'a=rtpmap', 'ulpfec/90000');
        if (ulpfecIndex) {
            sdpLines.splice(ulpfecIndex, 1);
            return sdpLines.join('\r\n');
        }
        return sdp;
    }

    function setVideoBitrates(sdp, params) {
        params = params || {};
        var xgoogle_min_bitrate = params.min;
        var xgoogle_max_bitrate = params.max;

        var sdpLines = sdp.split('\r\n');

        // VP8
        var vp8Index = findLine(sdpLines, 'a=rtpmap', 'VP8/90000');
        var vp8Payload;
        if (vp8Index) {
            vp8Payload = getCodecPayloadType(sdpLines[vp8Index]);
        }

        if (!vp8Payload) {
            return sdp;
        }

        var rtxIndex = findLine(sdpLines, 'a=rtpmap', 'rtx/90000');
        var rtxPayload;
        if (rtxIndex) {
            rtxPayload = getCodecPayloadType(sdpLines[rtxIndex]);
        }

        if (!rtxIndex) {
            return sdp;
        }

        var rtxFmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + rtxPayload.toString());
        if (rtxFmtpLineIndex !== null) {
            var appendrtxNext = '\r\n';
            appendrtxNext += 'a=fmtp:' + vp8Payload + ' x-google-min-bitrate=' + (xgoogle_min_bitrate || '228') + '; x-google-max-bitrate=' + (xgoogle_max_bitrate || '228');
            sdpLines[rtxFmtpLineIndex] = sdpLines[rtxFmtpLineIndex].concat(appendrtxNext);
            sdp = sdpLines.join('\r\n');
        }

        return sdp;
    }

    function setOpusAttributes(sdp, params) {
        params = params || {};

        var sdpLines = sdp.split('\r\n');

        // Opus
        var opusIndex = findLine(sdpLines, 'a=rtpmap', 'opus/48000');
        var opusPayload;
        if (opusIndex) {
            opusPayload = getCodecPayloadType(sdpLines[opusIndex]);
        }

        if (!opusPayload) {
            return sdp;
        }

        var opusFmtpLineIndex = findLine(sdpLines, 'a=fmtp:' + opusPayload.toString());
        if (opusFmtpLineIndex === null) {
            return sdp;
        }

        var appendOpusNext = '';
        appendOpusNext += '; stereo=' + (typeof params.stereo != 'undefined' ? params.stereo : '1');
        appendOpusNext += '; sprop-stereo=' + (typeof params['sprop-stereo'] != 'undefined' ? params['sprop-stereo'] : '1');

        if (typeof params.maxaveragebitrate != 'undefined') {
            appendOpusNext += '; maxaveragebitrate=' + (params.maxaveragebitrate || 128 * 1024 * 8);
        }

        if (typeof params.maxplaybackrate != 'undefined') {
            appendOpusNext += '; maxplaybackrate=' + (params.maxplaybackrate || 128 * 1024 * 8);
        }

        if (typeof params.cbr != 'undefined') {
            appendOpusNext += '; cbr=' + (typeof params.cbr != 'undefined' ? params.cbr : '1');
        }

        if (typeof params.useinbandfec != 'undefined') {
            appendOpusNext += '; useinbandfec=' + params.useinbandfec;
        }

        if (typeof params.usedtx != 'undefined') {
            appendOpusNext += '; usedtx=' + params.usedtx;
        }

        if (typeof params.maxptime != 'undefined') {
            appendOpusNext += '\r\na=maxptime:' + params.maxptime;
        }

        sdpLines[opusFmtpLineIndex] = sdpLines[opusFmtpLineIndex].concat(appendOpusNext);

        sdp = sdpLines.join('\r\n');
        return sdp;
    }

    return {
        setApplicationSpecificBandwidth: function(sdp, bandwidth, isScreen) {
            return setBAS(sdp, bandwidth, isScreen);
        },
        setVideoBitrates: function(sdp, params) {
            return setVideoBitrates(sdp, params);
        },
        setOpusAttributes: function(sdp, params) {
            return setOpusAttributes(sdp, params);
        },
        delVideoUlpfec: function(sdp, params) {
            return delVideoUlpfec(sdp, params);
        },
    };
})();

function setBitrate(sdp) {
    sdp = BandwidthHandler.setVideoBitrates(sdp, {
        min: 160,
        max: 180 
    });

    return sdp;
}

function delUlpfec(sdp) {
    sdp = BandwidthHandler.delVideoUlpfec(sdp, {});
    return sdp;
}
