const socket = io();
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const muteBtn = document.getElementById('mute-btn');
const videoOffBtn = document.getElementById('video-off-btn');

let localStream;
let peerConnection;
let currentRoomId;
let isMuted = false;
let isVideoOff = false;

// Get user media
async function init() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = localStream;
  } catch (err) {
    console.error('Error accessing media devices:', err);
  }
}

// Start random chat
startBtn.addEventListener('click', async () => {
  startBtn.disabled = true;
  stopBtn.disabled = false;
  
  const response = await fetch('/random-room');
  const data = await response.json();
  currentRoomId = data.roomId;
  
  await startCall(currentRoomId);
});

// Stop chat
stopBtn.addEventListener('click', () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  if (currentRoomId) {
    socket.emit('leave-room', currentRoomId);
    currentRoomId = null;
  }
  
  startBtn.disabled = false;
  stopBtn.disabled = true;
});

// Toggle mute
muteBtn.addEventListener('click', () => {
  if (localStream) {
    const audioTracks = localStream.getAudioTracks();
    audioTracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
  }
});

// Toggle video
videoOffBtn.addEventListener('click', () => {
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    videoTracks.forEach(track => {
      track.enabled = !track.enabled;
    });
    isVideoOff = !isVideoOff;
    videoOffBtn.textContent = isVideoOff ? 'Turn Video On' : 'Turn Video Off';
  }
});

// Start WebRTC connection
async function startCall(roomId) {
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  peerConnection = new RTCPeerConnection(configuration);
  
  // Add local stream to connection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });
  
  // Listen for remote stream
  peerConnection.ontrack = event => {
    remoteVideo.srcObject = event.streams[0];
  };
  
  // ICE candidate handling
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      socket.emit('ice-candidate', roomId, event.candidate);
    }
  };
  
  // Create offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  
  socket.emit('join-room', roomId, offer);
  
  // Listen for signaling events
  socket.on('offer', async offer => {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', roomId, answer);
  });
  
  socket.on('answer', async answer => {
    if (!peerConnection) return;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  });
  
  socket.on('ice-candidate', async candidate => {
    if (!peerConnection) return;
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  });
  
  socket.on('user-connected', userId => {
    console.log('User connected:', userId);
  });
  
  socket.on('user-disconnected', userId => {
    console.log('User disconnected:', userId);
    if (remoteVideo.srcObject) {
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
    }
  });
}

// Initialize the app
init();
