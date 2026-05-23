import { initializeApp } from 'firebase/app';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';

// NOTE: 既存の src/main.js と同一の firebaseConfig を指定してください。
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const sessionIdInput = document.getElementById('sessionIdInput');
const connectBtn = document.getElementById('connectBtn');
const statusEl = document.getElementById('status');
const remoteVideo = document.getElementById('remoteVideo');

let pc = null;
let unsubscribeOfferCandidates = null;

const rtcConfig = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function setStatus(message) {
  statusEl.textContent = message;
}

function cleanupConnection() {
  if (unsubscribeOfferCandidates) {
    unsubscribeOfferCandidates();
    unsubscribeOfferCandidates = null;
  }

  if (pc) {
    pc.ontrack = null;
    pc.onicecandidate = null;
    pc.close();
    pc = null;
  }

  if (remoteVideo.srcObject) {
    remoteVideo.srcObject = null;
  }
}

async function connectAsViewer() {
  const sessionId = sessionIdInput.value.trim();
  if (!sessionId) {
    setStatus('sessionId を入力してください。');
    return;
  }

  cleanupConnection();
  setStatus('接続準備中...');

  const sessionRef = doc(db, 'screenShareSessions', sessionId);
  const offerCandidatesRef = collection(sessionRef, 'offerCandidates');
  const answerCandidatesRef = collection(sessionRef, 'answerCandidates');

  const sessionSnapshot = await getDoc(sessionRef);
  if (!sessionSnapshot.exists()) {
    setStatus('セッションが見つかりません。sessionId を確認してください。');
    return;
  }

  const sessionData = sessionSnapshot.data();
  if (!sessionData.offer) {
    setStatus('offer がまだ作成されていません。送信側の開始を待ってください。');
    return;
  }

  pc = new RTCPeerConnection(rtcConfig);

  pc.ontrack = (event) => {
    const [stream] = event.streams;
    if (stream) {
      remoteVideo.srcObject = stream;
      setStatus('受信映像を再生中です。');
    }
  };

  pc.onicecandidate = async (event) => {
    if (!event.candidate) {
      return;
    }

    await addDoc(answerCandidatesRef, event.candidate.toJSON());
  };

  await pc.setRemoteDescription(new RTCSessionDescription(sessionData.offer));

  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await setDoc(sessionRef, { answer: { type: answer.type, sdp: answer.sdp } }, { merge: true });

  unsubscribeOfferCandidates = onSnapshot(offerCandidatesRef, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type !== 'added') {
        return;
      }
      const data = change.doc.data();
      pc
        ?.addIceCandidate(new RTCIceCandidate(data))
        .catch((err) => setStatus(`ICE candidate 追加失敗: ${err.message}`));
    });
  });

  setStatus('answer を送信しました。接続確立を待っています...');
}

connectBtn.addEventListener('click', () => {
  connectAsViewer().catch((error) => {
    setStatus(`接続に失敗しました: ${error.message}`);
    cleanupConnection();
  });
});
