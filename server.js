const express = require('express');
const http = require('http');
const https = require('https');
const path = require('path');
const { Server } = require('socket.io');
const readline = require('readline');
const crypto = require('crypto');
const YahooFinance = require('yahoo-finance2').default;

// 설문 안내 메시지 억제 옵션 적용
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// DB 모듈 연동
const {
  ensureAdminAccount,
  registerUser,
  authenticateUser,
  updateUserBalance,
  buyStockDb,
  sellStockDb,
  createStockOrderDb,
  cancelStockOrderDb,
  processPendingOrdersDb,
  buyLottoTicketDb,
  getUserProfile,
  getAllUsersDb,
  adminUpdateUserDb,
  adminDeleteUserDb
} = require('./db');

const app = express();
let server = http.createServer(app);
let io = new Server(server);

const PORT = 8080;

app.use(express.static(path.join(__dirname, 'public')));

const players = {};
const activeGuestCodes = new Set();

// 1. 실시간 실제 유저 P2P 가위바위보 매칭 및 룸 상태 관리
let rpsWaitingQueue = []; // 매칭 대기열 [{ socketId, userId, nickname, betAmount }]
let rpsTimerInterval = null;

let rpsRealP2PRoom = {
  status: 'idle', // 'idle' | 'waiting' | 'matched' | 'finished'
  round: 1,
  betAmount: 0,
  totalPot: 0,
  player1: null, // { socketId, userId, nickname, choice: null }
  player2: null, // { socketId, userId, nickname, choice: null }
  timer: 10,
  resultText: '참여자를 기다리고 있습니다.'
};

// 2. 실시간 증시 20종목
let usdKrwRate = 1350;

const stocks = [
  { code: '005930', symbol: '005930.KS', name: '삼성전자', price: 74500, change: 0, isUs: false },
  { code: '000660', symbol: '000660.KS', name: 'SK하이닉스', price: 185000, change: 0, isUs: false },
  { code: '005380', symbol: '005380.KS', name: '현대자동차', price: 242000, change: 0, isUs: false },
  { code: '035420', symbol: '035420.KS', name: 'NAVER', price: 172000, change: 0, isUs: false },
  { code: '035720', symbol: '035720.KS', name: '카카오', price: 41500, change: 0, isUs: false },
  { code: '051910', symbol: '051910.KS', name: 'LG화학', price: 320000, change: 0, isUs: false },
  { code: '006400', symbol: '006400.KS', name: '삼성SDI', price: 345000, change: 0, isUs: false },
  { code: '068270', symbol: '068270.KS', name: '셀트리온', price: 198000, change: 0, isUs: false },
  { code: '105560', symbol: '105560.KS', name: 'KB금융', price: 83000, change: 0, isUs: false },
  { code: '055550', symbol: '055550.KS', name: '신한지주', price: 51000, change: 0, isUs: false },
  { code: 'AAPL', symbol: 'AAPL', name: '애플 (Apple)', price: 310000, change: 0, isUs: true },
  { code: 'MSFT', symbol: 'MSFT', name: '마이크로소프트 (MSFT)', price: 610000, change: 0, isUs: true },
  { code: 'NVDA', symbol: 'NVDA', name: '엔비디아 (NVIDIA)', price: 175000, change: 0, isUs: true },
  { code: 'GOOGL', symbol: 'GOOGL', name: '알파벳 (Google)', price: 235000, change: 0, isUs: true },
  { code: 'AMZN', symbol: 'AMZN', name: '아마존 (Amazon)', price: 260000, change: 0, isUs: true },
  { code: 'TSLA', symbol: 'TSLA', name: '테슬라 (Tesla)', price: 295000, change: 0, isUs: true },
  { code: 'META', symbol: 'META', name: '메타 (Meta)', price: 720000, change: 0, isUs: true },
  { code: 'AMD', symbol: 'AMD', name: 'AMD', price: 210000, change: 0, isUs: true },
  { code: 'NFLX', symbol: 'NFLX', name: '넷플릭스 (Netflix)', price: 920000, change: 0, isUs: true },
  { code: 'INTC', symbol: 'INTC', name: '인텔 (Intel)', price: 31000, change: 0, isUs: true }
];

function getMarketStatus() {
  const now = new Date();
  const kstOffset = 9 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const kstDate = new Date(utc + (kstOffset * 60000));

  const day = kstDate.getDay();
  const hour = kstDate.getHours();
  const min = kstDate.getMinutes();
  const timeVal = hour * 100 + min;

  const isKrOpen = (day >= 1 && day <= 5) && (timeVal >= 900 && timeVal <= 1530);

  let isUsOpen = false;
  if ((day >= 2 && day <= 6 && timeVal <= 500) || (day >= 1 && day <= 5 && timeVal >= 2230)) {
    isUsOpen = true;
  }

  return {
    isKrOpen,
    isUsOpen,
    krStatusText: isKrOpen ? '🟢 국내장 개장 중 (실시간 체결)' : '🔴 국내장 마감 (예약 주문 접수 중)',
    usStatusText: isUsOpen ? '🟢 미국장 개장 중 (실시간 체결)' : '🔴 미국장 마감 (예약 주문 접수 중)'
  };
}

let lastMarketStatus = getMarketStatus();

async function updateRealTimeStockQuotes() {
  try {
    try {
      const fxQuote = await yahooFinance.quote('USDKRW=X');
      if (fxQuote && fxQuote.regularMarketPrice) {
        usdKrwRate = fxQuote.regularMarketPrice;
      }
    } catch (_) {}

    const currentPriceMap = {};

    for (const stock of stocks) {
      try {
        const quote = await yahooFinance.quote(stock.symbol);
        if (quote && quote.regularMarketPrice) {
          if (stock.isUs) {
            stock.price = Math.round(quote.regularMarketPrice * usdKrwRate);
          } else {
            stock.price = Math.round(quote.regularMarketPrice);
          }
          if (quote.regularMarketChangePercent !== undefined) {
            stock.change = Number(quote.regularMarketChangePercent.toFixed(2));
          }
        }
      } catch (_) {}
      currentPriceMap[stock.code] = stock.price;
    }

    const currentStatus = getMarketStatus();

    if (!lastMarketStatus.isKrOpen && currentStatus.isKrOpen) {
      const executed = await processPendingOrdersDb(false, currentPriceMap);
      notifyExecutedOrders(executed);
    }

    if (!lastMarketStatus.isUsOpen && currentStatus.isUsOpen) {
      const executed = await processPendingOrdersDb(true, currentPriceMap);
      notifyExecutedOrders(executed);
    }

    lastMarketStatus = currentStatus;

    io.emit('stockUpdate', {
      stocks,
      marketStatus: currentStatus
    });
  } catch (err) {
    console.error('[증시 시세 갱신 오류]', err.message);
  }
}

async function notifyExecutedOrders(executedList) {
  for (const item of executedList) {
    for (const sockId in players) {
      if (players[sockId].userId === item.userId) {
        const userProfile = await getUserProfile(item.userId);
        players[sockId].balance = userProfile.balance;
        io.to(sockId).emit('orderExecuted', {
          order: item.order,
          balance: userProfile.balance,
          userStocks: userProfile.stocks,
          pendingOrders: userProfile.orders,
          message: `📢 [예약 주문 체결 완료] ${item.order.name} ${item.order.quantity}주 (${item.order.type === 'BUY' ? '매수' : '매도'})`
        });
      }
    }
  }
}

setInterval(updateRealTimeStockQuotes, 5000);
updateRealTimeStockQuotes();

// --- 🎟️ 동행복권 실시간 최신 당첨 번호 연동 ---
let lottoInfo = {
  round: 1115,
  ticketPrice: 1000,
  winningNumbers: [7, 12, 19, 23, 31, 38, 42],
  drawDate: '매주 토요일 20:35',
  returnValue: 'success'
};

function requestDonghangApi(drwNo) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'www.dhlottery.co.kr',
      port: 443,
      path: `/common.do?method=getLottoNumber&drwNo=${drwNo}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.dhlottery.co.kr/'
      },
      rejectUnauthorized: false,
      timeout: 6000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', (err) => { reject(err); });
    req.end();
  });
}

async function fetchDonghangLottoNumbers() {
  try {
    const firstDate = new Date('2002-12-07T21:00:00+09:00');
    const now = new Date();
    const diffWeeks = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24 * 7)) + 1;

    let targetDrwNo = diffWeeks;
    let data = null;

    try {
      data = await requestDonghangApi(targetDrwNo);
    } catch (_) {
      targetDrwNo -= 1;
      data = await requestDonghangApi(targetDrwNo);
    }

    if (!data || data.returnValue !== 'success') {
      targetDrwNo -= 1;
      data = await requestDonghangApi(targetDrwNo);
    }

    if (data && data.returnValue === 'success') {
      lottoInfo = {
        round: data.drwNo,
        ticketPrice: 1000,
        winningNumbers: [
          data.drwtNo1,
          data.drwtNo2,
          data.drwtNo3,
          data.drwtNo4,
          data.drwtNo5,
          data.drwtNo6,
          data.bnusNo
        ],
        drawDate: data.drwNoDate || '매주 토요일 20:35',
        returnValue: 'success'
      };
    }
  } catch (err) {
    console.log('🎟️ [동행복권] 기본 최신 공시 회차 정보를 유지합니다.');
  }
}

fetchDonghangLottoNumbers();
setInterval(fetchDonghangLottoNumbers, 10 * 60 * 1000);

function generateUniqueGuestCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code;
  let attempts = 0;
  do {
    code = '';
    const bytes = crypto.randomBytes(8);
    for (let i = 0; i < 8; i++) {
      code += characters[bytes[i] % characters.length];
    }
    attempts++;
    if (attempts > 10000) throw new Error('발급 가능한 코드가 없습니다.');
  } while (activeGuestCodes.has(code));

  activeGuestCodes.add(code);
  return code;
}

// ==========================================
// ⚔️ 실제 유저 1:1 P2P 가위바위보 매칭 & 정산 로직
// ==========================================

function broadcastP2PRoomState() {
  io.emit('rpsRealUpdate', {
    status: rpsRealP2PRoom.status,
    round: rpsRealP2PRoom.round,
    betAmount: rpsRealP2PRoom.betAmount,
    totalPot: rpsRealP2PRoom.totalPot,
    timer: rpsRealP2PRoom.timer,
    resultText: rpsRealP2PRoom.resultText,
    player1: rpsRealP2PRoom.player1 ? {
      nickname: rpsRealP2PRoom.player1.nickname,
      submitted: !!rpsRealP2PRoom.player1.choice,
      choice: rpsRealP2PRoom.status === 'finished' ? rpsRealP2PRoom.player1.choice : null
    } : null,
    player2: rpsRealP2PRoom.player2 ? {
      nickname: rpsRealP2PRoom.player2.nickname,
      submitted: !!rpsRealP2PRoom.player2.choice,
      choice: rpsRealP2PRoom.status === 'finished' ? rpsRealP2PRoom.player2.choice : null
    } : null
  });
}

function startP2PMatch(p1, p2, betAmount) {
  clearInterval(rpsTimerInterval);

  rpsRealP2PRoom.status = 'matched';
  rpsRealP2PRoom.betAmount = betAmount;
  rpsRealP2PRoom.totalPot = betAmount * 2;
  rpsRealP2PRoom.player1 = { ...p1, choice: null };
  rpsRealP2PRoom.player2 = { ...p2, choice: null };
  rpsRealP2PRoom.timer = 10;
  rpsRealP2PRoom.resultText = '대결 시작! 10초 이내에 가위/바위/보를 선택하세요!';

  broadcastP2PRoomState();

  rpsTimerInterval = setInterval(() => {
    rpsRealP2PRoom.timer -= 1;
    io.emit('rpsRealTimer', { timer: rpsRealP2PRoom.timer });

    if (rpsRealP2PRoom.timer <= 0) {
      clearInterval(rpsTimerInterval);
      resolveP2PMatchResult();
    }
  }, 1000);
}

// 10초 경과 또는 양측 선택 완료 시 판정 및 상금 정산 (Null 안전성 보강)
async function resolveP2PMatchResult() {
  clearInterval(rpsTimerInterval);

  // 이미 방이 리셋되었거나 플레이어 정보가 없는 경우 안전 탈출
  if (rpsRealP2PRoom.status !== 'matched') return;

  const p1 = rpsRealP2PRoom.player1;
  const p2 = rpsRealP2PRoom.player2;

  // 두 플레이어 모두 유실된 경우 초기화
  if (!p1 && !p2) {
    rpsRealP2PRoom.status = 'idle';
    rpsRealP2PRoom.resultText = '참여자를 기다리고 있습니다.';
    broadcastP2PRoomState();
    return;
  }

  const pot = rpsRealP2PRoom.totalPot;
  let winner = null;
  let resultMsg = '';

  const c1 = p1 ? p1.choice : null;
  const c2 = p2 ? p2.choice : null;

  // 1. 기권패 및 접속 종료 상황 판정
  if (!p1 && p2) {
    winner = 'p2';
    resultMsg = `상대방 퇴장으로 🏆 [${p2.nickname}] 부전승!`;
  } else if (p1 && !p2) {
    winner = 'p1';
    resultMsg = `상대방 퇴장으로 🏆 [${p1.nickname}] 부전승!`;
  } else if (!c1 && !c2) {
    winner = 'both_forfeit';
    resultMsg = '두 플레이어 모두 시간 초과로 무효 처리되었습니다. (배팅금 전액 환급)';
  } else if (!c1 && c2) {
    winner = 'p2';
    resultMsg = `[${p1.nickname}] 시간 초과 기권패! 🏆 [${p2.nickname}] 최종 승리!`;
  } else if (c1 && !c2) {
    winner = 'p1';
    resultMsg = `[${p2.nickname}] 시간 초과 기권패! 🏆 [${p1.nickname}] 최종 승리!`;
  } else {
    // 2. 정상 대결 판정
    if (c1 === c2) {
      winner = 'draw';
      resultMsg = `무승부 (${c1} vs ${c2})! 배팅금이 전액 환급됩니다.`;
    } else if (
      (c1 === '가위' && c2 === '보') ||
      (c1 === '바위' && c2 === '가위') ||
      (c1 === '보' && c2 === '바위')
    ) {
      winner = 'p1';
      resultMsg = `🏆 [${p1.nickname}] 승리 (${c1} > ${c2})! 총 상금 ${pot.toLocaleString()}원 획득!`;
    } else {
      winner = 'p2';
      resultMsg = `🏆 [${p2.nickname}] 승리 (${c2} > ${c1})! 총 상금 ${pot.toLocaleString()}원 획득!`;
    }
  }

  rpsRealP2PRoom.status = 'finished';
  rpsRealP2PRoom.resultText = resultMsg;
  broadcastP2PRoomState();

  // 상금 및 환급금 지급 처리
  try {
    if (winner === 'p1' && p1) {
      await updateUserBalance(p1.userId, pot);
    } else if (winner === 'p2' && p2) {
      await updateUserBalance(p2.userId, pot);
    } else if (winner === 'draw' || winner === 'both_forfeit') {
      // 무승부 또는 둘 다 미선택 시 배팅금 전액 반환
      if (p1) await updateUserBalance(p1.userId, rpsRealP2PRoom.betAmount);
      if (p2) await updateUserBalance(p2.userId, rpsRealP2PRoom.betAmount);
    }

    // 잔액 업데이트 브로드캐스트
    for (const p of [p1, p2]) {
      if (p) {
        const updated = await getUserProfile(p.userId);
        if (players[p.socketId]) players[p.socketId].balance = updated.balance;
        io.to(p.socketId).emit('balanceUpdate', { balance: updated.balance });
      }
    }
  } catch (dbErr) {
    console.error('[P2P 상금 정산 오류]', dbErr.message);
  }

  // 6초 후 방 초기화 및 대기열 확인
  setTimeout(() => {
    rpsRealP2PRoom.status = 'idle';
    rpsRealP2PRoom.round += 1;
    rpsRealP2PRoom.player1 = null;
    rpsRealP2PRoom.player2 = null;
    rpsRealP2PRoom.betAmount = 0;
    rpsRealP2PRoom.totalPot = 0;
    rpsRealP2PRoom.resultText = '참여자를 기다리고 있습니다.';
    broadcastP2PRoomState();

    checkNextP2PMatch();
  }, 6000);
}

function checkNextP2PMatch() {
  if (rpsRealP2PRoom.status === 'idle' && rpsWaitingQueue.length >= 2) {
    const p1 = rpsWaitingQueue.shift();
    const p2 = rpsWaitingQueue.shift();
    startP2PMatch(p1, p2, p1.betAmount);
  } else if (rpsWaitingQueue.length === 1) {
    rpsRealP2PRoom.status = 'waiting';
    rpsRealP2PRoom.resultText = `[${rpsWaitingQueue[0].nickname}] 님이 상대 매칭을 기다리는 중입니다...`;
    broadcastP2PRoomState();
  }
}

// 소켓 핸들러
function setupSocketIO(ioInstance) {
  ioInstance.on('connection', (socket) => {
    function releaseGuestCode(sockId) {
      const player = players[sockId];
      if (player && player.guestCode) {
        activeGuestCodes.delete(player.guestCode);
        delete player.guestCode;
      }
    }

    // 1. 게스트 입장
    socket.on('guestJoin', () => {
      releaseGuestCode(socket.id);

      const guestCode = generateUniqueGuestCode();
      const nickname = `Guest_${guestCode}`;

      players[socket.id] = {
        socketId: socket.id,
        guestCode: guestCode,
        nickname: nickname,
        isGuest: true,
        role: 'GUEST',
        balance: 0
      };

      socket.emit('guestJoined', {
        guestCode,
        nickname,
        isGuest: true,
        role: 'GUEST',
        stocks,
        marketStatus: getMarketStatus(),
        lottoInfo
      });

      broadcastP2PRoomState();
    });

    socket.on('guestLeave', () => {
      const player = players[socket.id];
      if (player) {
        releaseGuestCode(socket.id);
        delete players[socket.id];
      }
      socket.emit('guestLeft');
    });

    // 2. 회원가입 & 로그인
    socket.on('register', async (data) => {
      try {
        if (!data || !data.username || !data.password || !data.nickname) {
          return socket.emit('authError', { message: '모든 회원가입 정보를 올바르게 입력해 주세요.' });
        }
        await registerUser(data.username, data.password, data.nickname);
        socket.emit('authSuccess', { message: '회원가입이 완료되었습니다. 로그인해 주세요.' });
      } catch (err) {
        socket.emit('authError', { message: err.message || '회원가입 실패' });
      }
    });

    socket.on('login', async (data) => {
      try {
        if (!data || !data.username || !data.password) {
          return socket.emit('authError', { message: '아이디와 비밀번호를 입력해 주세요.' });
        }

        const user = await authenticateUser(data.username, data.password);
        if (!user) {
          return socket.emit('authError', { message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        }

        releaseGuestCode(socket.id);

        players[socket.id] = {
          socketId: socket.id,
          userId: user.id,
          nickname: user.nickname,
          role: user.role,
          isGuest: false,
          balance: user.balance
        };

        socket.emit('loginSuccess', {
          id: user.id,
          nickname: user.nickname,
          role: user.role,
          balance: user.balance,
          isGuest: false,
          stocks,
          marketStatus: getMarketStatus(),
          userStocks: user.stocks,
          lottoTickets: user.lottoTickets,
          pendingOrders: user.orders,
          lottoInfo
        });

        broadcastP2PRoomState();
      } catch (err) {
        socket.emit('authError', { message: '로그인 처리 중 오류가 발생했습니다.' });
      }
    });

    // 👑 관리자 이벤트
    socket.on('adminGetUsers', async () => {
      const player = players[socket.id];
      if (!player || (player.role !== 'ADMIN' && player.role !== 'SUBADMIN')) {
        return socket.emit('gameError', { message: '관리자 권한이 없습니다.' });
      }
      try {
        const users = await getAllUsersDb();
        socket.emit('adminUsersList', { users, myRole: player.role });
      } catch (err) {
        socket.emit('gameError', { message: '유저 목록을 불러오지 못했습니다.' });
      }
    });

    socket.on('adminUpdateUser', async (data) => {
      const player = players[socket.id];
      if (!player || (player.role !== 'ADMIN' && player.role !== 'SUBADMIN')) {
        return socket.emit('gameError', { message: '수정 권한이 없습니다.' });
      }
      try {
        const updated = await adminUpdateUserDb(player.role, data.userId, data.updateData);
        for (const sockId in players) {
          if (players[sockId].userId === updated.id) {
            players[sockId].nickname = updated.nickname;
            players[sockId].balance = updated.balance;
            players[sockId].role = updated.role;
            io.to(sockId).emit('balanceUpdate', {
              balance: updated.balance,
              message: '관리자에 의해 회원 정보 또는 잔액이 변경되었습니다.'
            });
          }
        }
        const refreshedUsers = await getAllUsersDb();
        socket.emit('adminUsersList', { users: refreshedUsers, myRole: player.role });
        socket.emit('adminSuccess', { message: `[${updated.username}] 유저 정보가 수정되었습니다.` });
      } catch (err) {
        socket.emit('gameError', { message: err.message || '유저 정보 수정 실패' });
      }
    });

    socket.on('adminDeleteUser', async (data) => {
      const player = players[socket.id];
      if (!player || player.role !== 'ADMIN') {
        return socket.emit('gameError', { message: '계정 삭제는 최고 관리자만 가능합니다.' });
      }
      try {
        const deleted = await adminDeleteUserDb(player.role, data.userId);
        for (const sockId in players) {
          if (players[sockId].userId === deleted.id) {
            io.to(sockId).emit('accountDeleted', { message: '관리자에 의해 계정이 삭제되었습니다.' });
            delete players[sockId];
          }
        }
        const refreshedUsers = await getAllUsersDb();
        socket.emit('adminUsersList', { users: refreshedUsers, myRole: player.role });
        socket.emit('adminSuccess', { message: `[${deleted.username}] 계정이 삭제되었습니다.` });
      } catch (err) {
        socket.emit('gameError', { message: err.message || '계정 삭제 실패' });
      }
    });

    // ==========================================
    // ⚔️ 실제 유저 P2P 매칭 참가 및 가위바위보 제출
    // ==========================================

    socket.on('joinP2PRPS', async (data) => {
      const player = players[socket.id];
      if (!player || player.isGuest) {
        return socket.emit('gameError', { message: '로그인 후 플레이어 대전에 참여할 수 있습니다.' });
      }

      if (rpsWaitingQueue.some(q => q.socketId === socket.id)) {
        return socket.emit('gameError', { message: '이미 상대 매칭 대기열에 참가 중입니다.' });
      }
      if (rpsRealP2PRoom.status === 'matched' && (rpsRealP2PRoom.player1?.socketId === socket.id || rpsRealP2PRoom.player2?.socketId === socket.id)) {
        return socket.emit('gameError', { message: '이미 진행 중인 매치가 있습니다.' });
      }

      const betAmount = parseInt(data.betAmount, 10);
      if (isNaN(betAmount) || betAmount <= 0) {
        return socket.emit('gameError', { message: '올바른 배팅 금액을 설정해 주세요.' });
      }
      if (player.balance < betAmount) {
        return socket.emit('gameError', { message: '잔액이 부족합니다.' });
      }

      await updateUserBalance(player.userId, -betAmount);
      const updated = await getUserProfile(player.userId);
      player.balance = updated.balance;
      socket.emit('balanceUpdate', { balance: player.balance });

      const queueItem = {
        socketId: socket.id,
        userId: player.userId,
        nickname: player.nickname,
        betAmount
      };

      if (rpsRealP2PRoom.status === 'idle' && rpsWaitingQueue.length === 0) {
        rpsWaitingQueue.push(queueItem);
        rpsRealP2PRoom.status = 'waiting';
        rpsRealP2PRoom.resultText = `[${player.nickname}] 님이 상대 매칭을 기다리는 중입니다...`;
        broadcastP2PRoomState();
        socket.emit('rpsQueueWaiting', { message: '상대 플레이어를 기다리는 중입니다...' });
      } else if (rpsWaitingQueue.length > 0 && rpsRealP2PRoom.status !== 'matched') {
        const opponent = rpsWaitingQueue.shift();
        startP2PMatch(opponent, queueItem, queueItem.betAmount);
      } else {
        rpsWaitingQueue.push(queueItem);
        socket.emit('rpsQueueWaiting', { message: '현재 경기가 끝난 후 순차 매칭됩니다.' });
      }
    });

    socket.on('submitP2PChoice', (data) => {
      const player = players[socket.id];
      if (!player || rpsRealP2PRoom.status !== 'matched') return;

      const choice = data.choice;
      if (!['가위', '바위', '보'].includes(choice)) return;

      let isMyTurn = false;
      if (rpsRealP2PRoom.player1 && rpsRealP2PRoom.player1.socketId === socket.id) {
        rpsRealP2PRoom.player1.choice = choice;
        isMyTurn = true;
      } else if (rpsRealP2PRoom.player2 && rpsRealP2PRoom.player2.socketId === socket.id) {
        rpsRealP2PRoom.player2.choice = choice;
        isMyTurn = true;
      }

      if (isMyTurn) {
        socket.emit('rpsChoiceConfirmed', { choice });
        broadcastP2PRoomState();

        if (rpsRealP2PRoom.player1?.choice && rpsRealP2PRoom.player2?.choice) {
          clearInterval(rpsTimerInterval);
          resolveP2PMatchResult();
        }
      }
    });

    // 🎟️ 로또 구매
    socket.on('buyLotto', async (data) => {
      const player = players[socket.id];
      if (!player || player.isGuest) return socket.emit('gameError', { message: '로그인 후 응모 가능합니다.' });

      try {
        let numbers = [];
        const isAuto = data.mode === 'AUTO';

        if (isAuto) {
          const set = new Set();
          while (set.size < 7) set.add(Math.floor(Math.random() * 45) + 1);
          numbers = Array.from(set).sort((a, b) => a - b);
        } else {
          if (!Array.isArray(data.numbers) || data.numbers.length !== 7) {
            return socket.emit('gameError', { message: '7개의 번호를 모두 선택해 주세요.' });
          }
          const set = new Set(data.numbers.map(n => parseInt(n, 10)));
          if (set.size !== 7 || [...set].some(n => isNaN(n) || n < 1 || n > 45)) {
            return socket.emit('gameError', { message: '1~45 사이의 중복 없는 7개 번호를 입력하세요.' });
          }
          numbers = Array.from(set).sort((a, b) => a - b);
        }

        const numbersStr = numbers.join(',');
        const updated = await buyLottoTicketDb(player.userId, lottoInfo.round, numbersStr, lottoInfo.ticketPrice);
        player.balance = updated.balance;

        socket.emit('lottoSuccess', {
          mode: isAuto ? '자동' : '수동',
          numbers: numbers,
          round: lottoInfo.round,
          balance: player.balance,
          tickets: updated.lottoTickets
        });
      } catch (err) {
        socket.emit('gameError', { message: err.message });
      }
    });

    // 주식 거래
    socket.on('tradeStock', async (data) => {
      const player = players[socket.id];
      if (!player || player.isGuest) return socket.emit('gameError', { message: '로그인 후 거래 가능합니다.' });

      const { type, code, quantity } = data;
      const stock = stocks.find(s => s.code === code);
      if (!stock) return socket.emit('gameError', { message: '존재하지 않는 종목입니다.' });

      const qty = parseInt(quantity, 10);
      if (isNaN(qty) || qty <= 0) return socket.emit('gameError', { message: '수량을 1주 이상 입력하세요.' });

      const market = getMarketStatus();
      const isOpen = stock.isUs ? market.isUsOpen : market.isKrOpen;

      try {
        if (isOpen) {
          let updatedProfile;
          if (type === 'BUY') {
            updatedProfile = await buyStockDb(player.userId, stock.code, stock.name, qty, stock.price);
          } else if (type === 'SELL') {
            updatedProfile = await sellStockDb(player.userId, stock.code, qty, stock.price);
          }
          player.balance = updatedProfile.balance;

          socket.emit('stockTradeSuccess', {
            balance: player.balance,
            userStocks: updatedProfile.stocks,
            pendingOrders: updatedProfile.orders,
            message: `⚡ [실시간 체결] ${stock.name} ${qty}주 ${type === 'BUY' ? '매수' : '매도'} 완료!`
          });
        } else {
          const updatedProfile = await createStockOrderDb(
            player.userId,
            type,
            stock.code,
            stock.name,
            qty,
            stock.isUs,
            stock.price
          );
          player.balance = updatedProfile.balance;

          socket.emit('stockTradeSuccess', {
            balance: player.balance,
            userStocks: updatedProfile.stocks,
            pendingOrders: updatedProfile.orders,
            message: `📝 [장마감 예약 접수] ${stock.name} ${qty}주 (${type === 'BUY' ? '매수' : '매도'}) 예약 완료!`
          });
        }
      } catch (err) {
        socket.emit('gameError', { message: err.message });
      }
    });

    socket.on('cancelOrder', async (data) => {
      const player = players[socket.id];
      if (!player || player.isGuest) return;

      const { orderId, code } = data;
      const stock = stocks.find(s => s.code === code);
      const estPrice = stock ? stock.price : 0;

      try {
        const updatedProfile = await cancelStockOrderDb(player.userId, parseInt(orderId, 10), estPrice);
        player.balance = updatedProfile.balance;

        socket.emit('stockTradeSuccess', {
          balance: player.balance,
          userStocks: updatedProfile.stocks,
          pendingOrders: updatedProfile.orders,
          message: '예약 주문이 취소되었습니다.'
        });
      } catch (err) {
        socket.emit('gameError', { message: err.message });
      }
    });

    // AI 가위바위보
    socket.on('playAiRps', async (data) => {
      const player = players[socket.id];
      if (!player || player.isGuest) return socket.emit('gameError', { message: '로그인 후 참여 가능합니다.' });

      const { choice, betAmount } = data;
      const amount = parseInt(betAmount, 10);
      if (isNaN(amount) || amount <= 0) return socket.emit('gameError', { message: '배팅 금액을 확인하세요.' });
      if (player.balance < amount) return socket.emit('gameError', { message: '잔액이 부족합니다.' });

      await updateUserBalance(player.userId, -amount);

      const choices = ['가위', '바위', '보'];
      const aiChoice = choices[Math.floor(Math.random() * 3)];
      let result = '';
      let reward = 0;

      if (choice === aiChoice) {
        result = 'draw';
        reward = amount;
      } else if (
        (choice === '가위' && aiChoice === '보') ||
        (choice === '바위' && aiChoice === '가위') ||
        (choice === '보' && aiChoice === '바위')
      ) {
        result = 'win';
        reward = amount * 2;
      } else {
        result = 'lose';
        reward = 0;
      }

      if (reward > 0) await updateUserBalance(player.userId, reward);

      const updated = await getUserProfile(player.userId);
      player.balance = updated.balance;

      socket.emit('aiRpsResult', {
        playerChoice: choice,
        aiChoice: aiChoice,
        result: result,
        reward: reward,
        balance: player.balance
      });
    });

    // 즉석복권
    socket.on('buyScratch', async (data) => {
      const player = players[socket.id];
      if (!player || player.isGuest) return socket.emit('gameError', { message: '로그인 후 구매 가능합니다.' });

      const price = parseInt(data.price, 10);
      if (player.balance < price) return socket.emit('gameError', { message: '잔액이 부족합니다.' });

      await updateUserBalance(player.userId, -price);

      const rand = Math.random() * 100;
      let winAmount = 0;
      let icons = ['❌', '❌', '❌'];

      if (rand < 1) { winAmount = price * 10; icons = ['👑', '👑', '👑']; }
      else if (rand < 5) { winAmount = price * 5; icons = ['💎', '💎', '💎']; }
      else if (rand < 15) { winAmount = price * 2; icons = ['⭐', '⭐', '⭐']; }
      else if (rand < 50) { winAmount = price; icons = ['🍀', '🍀', '🍀']; }
      else {
        const missIcons = ['🍒', '🍋', '🔔', '🍇', '🍉'];
        icons = [
          missIcons[Math.floor(Math.random() * missIcons.length)],
          missIcons[Math.floor(Math.random() * missIcons.length)],
          missIcons[Math.floor(Math.random() * missIcons.length)]
        ];
      }

      if (winAmount > 0) await updateUserBalance(player.userId, winAmount);

      const updated = await getUserProfile(player.userId);
      player.balance = updated.balance;

      socket.emit('scratchResult', {
        price,
        icons: icons.join(' '),
        winAmount,
        balance: player.balance,
        isWin: winAmount > 0
      });
    });

    // 확률도박
    socket.on('playDice', async (data) => {
      const player = players[socket.id];
      if (!player || player.isGuest) return socket.emit('gameError', { message: '로그인 후 참여 가능합니다.' });

      const bet = parseInt(data.amount, 10);
      const targetPercent = parseInt(data.targetPercent, 10);
      if (isNaN(bet) || bet <= 0) return socket.emit('gameError', { message: '배팅 금액을 확인하세요.' });
      if (player.balance < bet) return socket.emit('gameError', { message: '잔액이 부족합니다.' });

      await updateUserBalance(player.userId, -bet);

      const roll = Math.floor(Math.random() * 100) + 1;
      const isWin = roll <= targetPercent;
      let reward = 0;

      if (isWin) {
        const mult = (100 / targetPercent);
        reward = Math.floor(bet * mult);
        await updateUserBalance(player.userId, reward);
      }

      const updated = await getUserProfile(player.userId);
      player.balance = updated.balance;

      socket.emit('diceResult', {
        roll,
        targetPercent,
        bet,
        reward,
        isWin,
        balance: player.balance
      });
    });

    // 연결 종료 시 처리
    socket.on('disconnecting', () => {
      const player = players[socket.id];
      if (player) {
        releaseGuestCode(socket.id);

        const qIdx = rpsWaitingQueue.findIndex(q => q.socketId === socket.id);
        if (qIdx !== -1) {
          const removed = rpsWaitingQueue.splice(qIdx, 1)[0];
          updateUserBalance(removed.userId, removed.betAmount);
          checkNextP2PMatch();
        }

        if (rpsRealP2PRoom.status === 'matched') {
          if (rpsRealP2PRoom.player1 && rpsRealP2PRoom.player1.socketId === socket.id) {
            rpsRealP2PRoom.player1.choice = null;
            resolveP2PMatchResult();
          } else if (rpsRealP2PRoom.player2 && rpsRealP2PRoom.player2.socketId === socket.id) {
            rpsRealP2PRoom.player2.choice = null;
            resolveP2PMatchResult();
          }
        }

        delete players[socket.id];
      }
    });

    socket.on('disconnect', () => {
      const player = players[socket.id];
      if (player) {
        releaseGuestCode(socket.id);
        delete players[socket.id];
      }
    });
  });
}

setupSocketIO(io);

// 서버 구동 (중복 리슨 방지)
let isListening = false;

// 서버 구동
// ==========================================
// 🔄 무중단 안전 재부팅 및 서버 구동 엔진
// ==========================================

async function startServer() {
  try {
    await ensureAdminAccount();
  } catch (e) {
    console.error('관리자 계정 초기화 실패:', e.message);
  }

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🎰 가상 도박 & 투자 시뮬레이션 서버: http://localhost:${PORT}`);
    console.log(`⚔️ 실제 플레이어 1:1 실시간 매칭 & 승자독식 시스템 가동`);
    console.log(`📌 터미널 커맨드: 'rs' (즉시 안전 재부팅) | 'kill' (종료)`);
    console.log(`======================================================\n`);
  });
}

function restartServerGracefully() {
  console.log('\n🔄 서버 내부 상태 및 소켓을 완전히 초기화하고 재부팅합니다...');

  // 1. 진행 중인 P2P 매치 타이머 해제
  clearInterval(rpsTimerInterval);

  // 2. 접속자 및 매칭 대기열 메모리 초기화
  for (const key in players) delete players[key];
  activeGuestCodes.clear();
  rpsWaitingQueue.length = 0;
  rpsRealP2PRoom = {
    status: 'idle',
    round: 1,
    betAmount: 0,
    totalPot: 0,
    player1: null,
    player2: null,
    timer: 10,
    resultText: '참여자를 기다리고 있습니다.'
  };

  // 3. 소켓 및 HTTP 서버 닫기 후 새 인스턴스 재생성
  io.close(() => {
    server.close(() => {
      server = http.createServer(app);
      io = new Server(server);
      setupSocketIO(io);
      startServer();
      console.log('✅ 서버 재부팅이 완벽하게 완료되었습니다.\n');
    });
  });
}

startServer();

// 터미널 키 입력 리스너 (스트림 단절 없는 안전 구조)
if (process.stdin.isTTY) {
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  process.stdin.on('data', (chunk) => {
    const command = chunk.toString().trim().toLowerCase();

    if (command === 'kill') {
      console.log('\n🛑 서버를 종료합니다...');
      process.exit(0);
    } else if (command === 'rs') {
      restartServerGracefully();
    }
  });
}