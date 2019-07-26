'use strict';

const audioInputSelect = document.querySelector('select#audioSource');
const audioOutputSelect = document.querySelector('select#audioOutput');
const videoSelect = document.querySelector('select#videoSource');
const selectors = [audioInputSelect, audioOutputSelect, videoSelect];

audioOutputSelect.disabled = !('sinkId' in HTMLMediaElement.prototype);

var stopAudioBtn=document.getElementById('stopAudioBtn');
var removeAudioBtn=document.getElementById('removeAudioBtn');
stopAudioBtn.addEventListener('click', stopAudio);
removeAudioBtn.addEventListener('click', removeAudio);

function removeAudio() {
  var sender = window.pc1.getSenders().find(function(s) {
    return s.track.kind == "audio";
  });
  
  window.pc1.removeTrack(sender);  
}

function stopAudio() {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      if (track.kind === "audio") {
        track.stop();
        console.log("stop audio");  
      }
    });
  }
}

function gotDevices(deviceInfos) {
  // Handles being called several times to update labels. Preserve values.
  const values = selectors.map(select => select.value);
  selectors.forEach(select => {
    while (select.firstChild) {
      select.removeChild(select.firstChild);
    }
  });
  for (let i = 0; i !== deviceInfos.length; ++i) {
    const deviceInfo = deviceInfos[i];
    const option = document.createElement('option');
    option.value = deviceInfo.deviceId;
    if (deviceInfo.kind === 'audioinput') {
      option.text = deviceInfo.label || `microphone ${audioInputSelect.length + 1}`;
      audioInputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'audiooutput') {
      option.text = deviceInfo.label || `speaker ${audioOutputSelect.length + 1}`;
      audioOutputSelect.appendChild(option);
    } else if (deviceInfo.kind === 'videoinput') {
      option.text = deviceInfo.label || `camera ${videoSelect.length + 1}`;
      videoSelect.appendChild(option);
    } else {
      console.log('Some other kind of source/device: ', deviceInfo);
    }
  }
  selectors.forEach((select, selectorIndex) => {
    if (Array.prototype.slice.call(select.childNodes).some(n => n.value === values[selectorIndex])) {
      select.value = values[selectorIndex];
    }
  });
}

navigator.mediaDevices.enumerateDevices().then(gotDevices).catch(handleError);

// Attach audio output device to video element using device/sink ID.
function attachSinkId(element, sinkId) {
  if (typeof element.sinkId !== 'undefined') {
    element.setSinkId(sinkId)
      .then(() => {
        console.log(`Success, audio output device attached: ${sinkId}`);
      })
      .catch(error => {
        let errorMessage = error;
        if (error.name === 'SecurityError') {
          errorMessage = `You need to use HTTPS for selecting audio output device: ${error}`;
        }
        console.error(errorMessage);
        // Jump back to first output device in the list as it's the default.
        audioOutputSelect.selectedIndex = 0;
      });
  } else {
    console.warn('Browser does not support output device selection.');
  }
}

function changeAudioDestination() {
  const audioDestination = audioOutputSelect.value;
}

//refer https://developer.mozilla.org/en-US/docs/Web/API/RTCRtpSender/replaceTrack
function gotStream(stream) {
  let videoTrack = stream.getVideoTracks()[0];
  var sender = window.pc1.getSenders().find(function(s) {
    return s.track.kind == videoTrack.kind;
  });
  sender.replaceTrack(videoTrack);

  let audioTrack = stream.getAudioTracks()[0];
  sender = window.pc1.getSenders().find(function(s) {
    return s.track.kind == audioTrack.kind;
  });
  sender.replaceTrack(audioTrack);  

  const video = document.getElementById('local');
  video.srcObject = stream;
  window.stream = stream;

  // Refresh button list in case labels have become available
  return navigator.mediaDevices.enumerateDevices();
}

function handleError(error) {
  console.log('navigator.MediaDevices.getUserMedia error: ', error.message, error.name);
}

function start2() {
  if (window.stream) {
    window.stream.getTracks().forEach(track => {
      track.stop();
    });
  }

  const audioSource = audioInputSelect.value;
  const videoSource = videoSelect.value;
  const constraints = {
    audio: {deviceId: audioSource ? {exact: audioSource} : undefined},
    video: {deviceId: videoSource ? {exact: videoSource} : undefined}
  };
  navigator.mediaDevices.getUserMedia(constraints).then(gotStream).then(gotDevices).catch(handleError);
}

audioInputSelect.onchange = start2;
audioOutputSelect.onchange = changeAudioDestination;

videoSelect.onchange = start2;

//start();
