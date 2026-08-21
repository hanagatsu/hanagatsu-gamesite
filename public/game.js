const socket = io();

// UI Elements
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const guestBtn = document.getElementById('guestBtn');
const leaveBtn = document.getElementById('leaveBtn');
const playerDisplay = document.getElementById('playerDisplay');
const userModeTag = document.getElementById('userModeTag');
const userBalanceBox = document.getElementById('userBalanceBox');
const playerBalance = document.getElementById('playerBalance');
const toast = document.getElementById('toast');

// Auth Form Elements
const tabLoginBtn = document.getElementById('tabLoginBtn');
const tabRegisterBtn = document.getElementById('tabRegisterBtn');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// RPS Elements (P2P Real Player Match)
const btnSubP2P = document.getElementById('btnSubP2P');
const btnSubAi = document.getElementById('btnSubAi');
const rpsP2PContainer = document.getElementById('rpsP2PContainer');
const rpsAiContainer = document.getElementById('rpsAiContainer');

const p2pPotBadge = document.getElementById('p2pPotBadge');
const p2pPlayer1Name = document.getElementById('p2pPlayer1Name');
const p2pPlayer2Name = document.getElementById('p2pPlayer2Name');
const p2pPlayer1Card = document.getElementById('p2pPlayer1Card');
const p2pPlayer2Card = document.getElementById('p2pPlayer2Card');
const p2pPlayer1Status = document.getElementById('p2pPlayer1Status');
const p2pPlayer2Status = document.getElementById('p2pPlayer2Status');
const p2pResultBox = document.getElementById('p2pResultBox');
const p2pTimerDisplay = document.getElementById('p2pTimerDisplay');
const p2pJoinBox = document.getElementById('p2pJoinBox');
const p2pChoiceBox = document.getElementById('p2pChoiceBox');
const p2pBetAmountInput = document.getElementById('p2pBetAmountInput');
const btnJoinP2PMatch = document.getElementById('btnJoinP2PMatch');

// AI RPS Elements
const aiMyChoice = document.getElementById('aiMyChoice');
const aiBotChoice = document.getElementById('aiBotChoice');
const aiRpsResult = document.getElementById('aiRpsResult');
const aiRpsBetAmount = document.getElementById('aiRpsBetAmount');
const aiPlayerNameDisplay = document.getElementById('aiPlayerNameDisplay');

// Lotto Elements
const lottoRoundBadge = document.getElementById('lottoRoundBadge');
const lottoDrawTitle = document.getElementById('lottoDrawTitle');
const lottoWinningBalls = document.getElementById('lottoWinningBalls');
const lottoDrawDateText = document.getElementById('lottoDrawDateText');
const btnLottoAutoTab = document.getElementById('btnLottoAutoTab');
const btnLottoManualTab = document.getElementById('btnLottoManualTab');
const lottoAutoView = document.getElementById('lottoAutoView');
const lottoManualView = document.getElementById('lottoManualView');
const lottoAutoBuyBtn = document.getElementById('lottoAutoBuyBtn');
const lottoManualBuyBtn = document.getElementById('lottoManualBuyBtn');
const lottoNumberGrid = document.getElementById('lottoNumberGrid');
const selectedCountDisplay = document.getElementById('selectedCountDisplay');
const resetSelectedBallsBtn = document.getElementById('resetSelectedBallsBtn');
const myLottoList = document.getElementById('myLottoList');

let selectedLottoNumbers = new Set();

// Dice Elements
const diceBetInput = document.getElementById('diceBetInput');
const dicePercentSlider = document.getElementById('dicePercentSlider');
const dicePercentLabel = document.getElementById('dicePercentLabel');
const diceRollBtn = document.getElementById('diceRollBtn');
const diceRollValue = document.getElementById('diceRollValue');
const diceWinRateDisplay = document.getElementById('diceWinRateDisplay');

// Stocks Elements
const stocksTableBody = document.getElementById('stocksTableBody');
const myStocksTableBody = document.getElementById('myStocksTableBody');
const myOrdersTableBody = document.getElementById('myOrdersTableBody');
const krMarketBadge = document.getElementById('krMarketBadge');
const usMarketBadge = document.getElementById('usMarketBadge');

// Admin Elements
const tabAdminBtn = document.getElementById('tabAdminBtn');
const adminUsersTableBody = document.getElementById('adminUsersTableBody');
const adminRefreshUsersBtn = document.getElementById('adminRefreshUsersBtn');

// 내 정보 수정 모달 요소
const btnUserProfile = document.getElementById('btnUserProfile');
const userProfileModal = document.getElementById('userProfileModal');
const userProfileForm = document.getElementById('userProfileForm');
const closeProfileModalBtn = document.getElementById('closeProfileModalBtn');
const cancelProfileModalBtn = document.getElementById('cancelProfileModalBtn');
const profileNewNickname = document.getElementById('profileNewNickname');
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const passwordSection = document.getElementById('passwordSection');
const profileCurrentPassword = document.getElementById('profileCurrentPassword');
const profileNewPassword = document.getElementById('profileNewPassword');
const profileConfirmPassword = document.getElementById('profileConfirmPassword');

// Modal Elements
const adminUserModal = document.getElementById('adminUserModal');
const adminUserEditForm = document.getElementById('adminUserEditForm');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const modalDeleteBtn = document.getElementById('modalDeleteBtn');
const editUserId = document.getElementById('editUserId');
const editUsername = document.getElementById('editUsername');
const editNickname = document.getElementById('editNickname');
const editBalance = document.getElementById('editBalance');
const editPassword = document.getElementById('editPassword');
const editRole = document.getElementById('editRole');
const editRoleGroup = document.getElementById('editRoleGroup');

let isPasswordEditMode = false;

let currentUser = {
  isGuest: true,
  role: 'GUEST',
  balance: 0,
  stocks: [],
  lottoTickets: [],
  orders: []
};

let currentMarketStatus = {
  isKrOpen: false,
  isUsOpen: false
};

// 토스트 메시지
function showToast(msg, isSuccess = false) {
  toast.textContent = msg;
  toast.style.backgroundColor = isSuccess ? '#10b981' : '#ef4444';
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// 탭 전환
tabLoginBtn.addEventListener('click', () => {
  tabLoginBtn.classList.add('active');
  tabRegisterBtn.classList.remove('active');
  loginForm.classList.remove('hidden');
  registerForm.classList.add('hidden');
});

tabRegisterBtn.addEventListener('click', () => {
  tabRegisterBtn.classList.add('active');
  tabLoginBtn.classList.remove('active');
  registerForm.classList.remove('hidden');
  loginForm.classList.add('hidden');
});

registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('regUsername').value.trim();
  const password = document.getElementById('regPassword').value.trim();
  const nickname = document.getElementById('regNickname').value.trim();

  if (!username || !password || !nickname) return showToast('모든 항목을 입력해 주세요.');
  socket.emit('register', { username, password, nickname });
});

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  if (!username || !password) return showToast('아이디와 비밀번호를 입력해 주세요.');
  socket.emit('login', { username, password });
});

socket.on('authSuccess', (data) => {
  showToast(data.message, true);
  registerForm.reset();
  tabLoginBtn.click();
});

socket.on('authError', (data) => {
  showToast(data.message);
});

// 메인 게임 탭 전환
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    const targetId = btn.getAttribute('data-tab');
    document.getElementById(targetId).classList.add('active');

    if (targetId === 'tab-admin') {
      socket.emit('adminGetUsers');
    }
  });
});

btnSubP2P.addEventListener('click', () => {
  btnSubP2P.classList.add('active');
  btnSubAi.classList.remove('active');
  rpsP2PContainer.classList.add('active');
  rpsAiContainer.classList.remove('active');
});

btnSubAi.addEventListener('click', () => {
  btnSubAi.classList.add('active');
  btnSubP2P.classList.remove('active');
  rpsAiContainer.classList.add('active');
  rpsP2PContainer.classList.remove('active');
});

// 게스트 입장
guestBtn.addEventListener('click', () => {
  socket.emit('guestJoin');
});

socket.on('guestJoined', (data) => {
  currentUser = { ...data, isGuest: true, role: 'GUEST' };
  currentMarketStatus = data.marketStatus || currentMarketStatus;
  playerDisplay.textContent = `Guest (#${data.guestCode})`;
  userModeTag.textContent = '관전 모드 (Read-Only)';
  userModeTag.className = 'mode-tag guest-tag';
  userBalanceBox.classList.add('hidden');
  tabAdminBtn.classList.add('hidden');
  aiPlayerNameDisplay.textContent = '게스트';

  setInteractiveElements(false);
  loginScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  renderLottoWinningInfo(data.lottoInfo);
  updateMarketBadges(currentMarketStatus);
  renderStocks(data.stocks);
});

// 로그인 성공
socket.on('loginSuccess', (data) => {
  currentUser = { ...data, isGuest: false };
  currentMarketStatus = data.marketStatus || currentMarketStatus;

  if (data.role === 'ADMIN') {
    playerDisplay.textContent = `👑 ${data.nickname}`;
    userModeTag.textContent = '최고 관리자';
    userModeTag.className = 'mode-tag admin-tag';
    tabAdminBtn.textContent = '👑 유저 관리 패널';
    tabAdminBtn.classList.remove('hidden');
    if (btnUserProfile) btnUserProfile.classList.add('hidden'); // 관리자는 숨김
  } else if (data.role === 'SUBADMIN') {
    playerDisplay.textContent = `🛡️ ${data.nickname}`;
    userModeTag.textContent = '부관리자';
    userModeTag.className = 'mode-tag subadmin-tag';
    tabAdminBtn.textContent = '🛡️ 유저 관리 패널';
    tabAdminBtn.classList.remove('hidden');
    if (btnUserProfile) btnUserProfile.classList.add('hidden'); // 부관리자는 숨김
  } else {
    // ⬇️ 일반 USER 등급일 때 버튼 노출
    playerDisplay.textContent = `${data.nickname} 님`;
    userModeTag.textContent = '플레이어';
    userModeTag.className = 'mode-tag member';
    tabAdminBtn.classList.add('hidden');
    if (btnUserProfile) {
      btnUserProfile.classList.remove('hidden'); // 👈 hidden 클래스 확실히 제거
    }
  }

  aiPlayerNameDisplay.textContent = data.nickname;
  playerBalance.textContent = Number(data.balance).toLocaleString();
  userBalanceBox.classList.remove('hidden');

  setInteractiveElements(true);
  loginScreen.classList.add('hidden');
  gameScreen.classList.remove('hidden');

  renderLottoWinningInfo(data.lottoInfo);
  updateMarketBadges(currentMarketStatus);
  renderStocks(data.stocks);
  renderMyStocks(data.userStocks || []);
  renderMyOrders(data.pendingOrders || []);
  renderMyLottoTickets(data.lottoTickets || []);
  showToast(`환영합니다, ${data.nickname}님!`, true);
});

socket.on('accountDeleted', (data) => {
  alert(data.message);
  location.reload();
});

socket.on('balanceUpdate', (data) => {
  currentUser.balance = data.balance;
  playerBalance.textContent = Number(data.balance).toLocaleString();
  if (data.message) showToast(data.message, true);
});

function setInteractiveElements(isEnabled) {
  document.querySelectorAll('[data-action]').forEach(btn => {
    if (isEnabled) {
      btn.classList.remove('disabled-btn');
      btn.removeAttribute('disabled');
    } else {
      btn.classList.add('disabled-btn');
      btn.setAttribute('disabled', 'true');
    }
  });

  if (aiRpsBetAmount) aiRpsBetAmount.disabled = !isEnabled;
  if (diceBetInput) diceBetInput.disabled = !isEnabled;
  if (dicePercentSlider) dicePercentSlider.disabled = !isEnabled;
  if (p2pBetAmountInput) p2pBetAmountInput.disabled = !isEnabled;
}

leaveBtn.addEventListener('click', () => {
  if (currentUser.isGuest) {
    socket.emit('guestLeave');
  } else {
    location.reload();
  }
});

socket.on('guestLeft', () => {
  gameScreen.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  showToast('게스트 모드에서 퇴장했습니다.');
});

// ==========================================
// ⚔️ 실제 유저 1:1 P2P 가위바위보 실시간 UI 핸들러
// ==========================================

btnJoinP2PMatch.addEventListener('click', () => {
  if (currentUser.isGuest) return showToast('관전 모드에서는 대전에 참여할 수 없습니다.');
  const betAmount = parseInt(p2pBetAmountInput.value, 10);
  if (isNaN(betAmount) || betAmount <= 0) return showToast('참가 배팅금을 입력하세요.');

  socket.emit('joinP2PRPS', { betAmount });
});

socket.on('rpsQueueWaiting', (data) => {
  showToast(data.message, true);
  btnJoinP2PMatch.disabled = true;
  btnJoinP2PMatch.textContent = '⏳ 상대 대기 중...';
});

// 10초 선택 버튼 클릭
document.querySelectorAll('.btn-p2p-choice').forEach(btn => {
  btn.addEventListener('click', () => {
    const choice = btn.dataset.choice;
    socket.emit('submitP2PChoice', { choice });
  });
});

socket.on('rpsChoiceConfirmed', (data) => {
  showToast(`[${data.choice}] 선택 완료! 상대방의 결정을 기다립니다.`, true);
  document.querySelectorAll('.btn-p2p-choice').forEach(b => {
    b.classList.remove('selected-choice');
    if (b.dataset.choice === data.choice) b.classList.add('selected-choice');
  });
});

// 실시간 P2P 아레나 상태 갱신
socket.on('rpsRealUpdate', (room) => {
  p2pPotBadge.textContent = `총 상금: ${room.totalPot.toLocaleString()}원 (판돈 ${room.betAmount.toLocaleString()}원)`;
  p2pResultBox.textContent = room.resultText;

  // 플레이어 1 상태
  if (room.player1) {
    p2pPlayer1Name.textContent = room.player1.nickname;
    p2pPlayer1Card.textContent = room.player1.choice || (room.player1.submitted ? '✔️' : '?');
    p2pPlayer1Status.textContent = room.player1.submitted ? '제출 완료' : '선택 중...';
    p2pPlayer1Status.className = room.player1.submitted ? 'submit-tag done' : 'submit-tag waiting';
  } else {
    p2pPlayer1Name.textContent = '플레이어 1 (대기 중)';
    p2pPlayer1Card.textContent = '?';
    p2pPlayer1Status.textContent = '미참여';
    p2pPlayer1Status.className = 'submit-tag';
  }

  // 플레이어 2 상태
  if (room.player2) {
    p2pPlayer2Name.textContent = room.player2.nickname;
    p2pPlayer2Card.textContent = room.player2.choice || (room.player2.submitted ? '✔️' : '?');
    p2pPlayer2Status.textContent = room.player2.submitted ? '제출 완료' : '선택 중...';
    p2pPlayer2Status.className = room.player2.submitted ? 'submit-tag done' : 'submit-tag waiting';
  } else {
    p2pPlayer2Name.textContent = '플레이어 2 (대기 중)';
    p2pPlayer2Card.textContent = '?';
    p2pPlayer2Status.textContent = '미참여';
    p2pPlayer2Status.className = 'submit-tag';
  }

  // 내가 현재 대결 참가자인지 확인
  const isParticipant = (room.player1 && room.player1.nickname === currentUser.nickname) ||
                        (room.player2 && room.player2.nickname === currentUser.nickname);

  if (room.status === 'matched' && isParticipant) {
    p2pJoinBox.classList.add('hidden');
    p2pChoiceBox.classList.remove('hidden');
  } else if (room.status === 'finished' || room.status === 'idle') {
    p2pChoiceBox.classList.add('hidden');
    p2pJoinBox.classList.remove('hidden');
    btnJoinP2PMatch.disabled = false;
    btnJoinP2PMatch.textContent = '⚔️ 매칭 참가 (플레이)';
    document.querySelectorAll('.btn-p2p-choice').forEach(b => b.classList.remove('selected-choice'));
  }
});

socket.on('rpsRealTimer', (data) => {
  p2pTimerDisplay.textContent = data.timer;
});

// --- 🎟️ 동행복권 실시간 당첨 정보 및 수동 선택판 ---
function renderLottoWinningInfo(info) {
  if (!info) return;
  lottoRoundBadge.textContent = `제 ${info.round}회 (1회 1,000원)`;
  lottoDrawTitle.textContent = `동행복권 제 ${info.round}회 공식 당첨 번호`;
  lottoDrawDateText.textContent = `추첨일자: ${info.drawDate || '매주 토요일 20:35'}`;

  lottoWinningBalls.innerHTML = '';
  info.winningNumbers.forEach((num, index) => {
    const ball = document.createElement('span');
    ball.className = index === 6 ? 'ball bonus-ball' : 'ball';
    ball.textContent = num;
    lottoWinningBalls.appendChild(ball);

    if (index === 5) {
      const plus = document.createElement('span');
      plus.style.fontSize = '20px';
      plus.style.fontWeight = 'bold';
      plus.style.color = '#ef4444';
      plus.style.alignSelf = 'center';
      plus.textContent = '+';
      lottoWinningBalls.appendChild(plus);
    }
  });
}

btnLottoAutoTab.addEventListener('click', () => {
  btnLottoAutoTab.classList.add('active');
  btnLottoManualTab.classList.remove('active');
  lottoAutoView.classList.add('active');
  lottoManualView.classList.remove('active');
});

btnLottoManualTab.addEventListener('click', () => {
  btnLottoManualTab.classList.add('active');
  btnLottoAutoTab.classList.remove('active');
  lottoManualView.classList.add('active');
  lottoAutoView.classList.remove('active');
  initLottoNumberGrid();
});

function initLottoNumberGrid() {
  if (!lottoNumberGrid || lottoNumberGrid.children.length > 0) return;
  lottoNumberGrid.innerHTML = '';

  for (let i = 1; i <= 45; i++) {
    const ballBtn = document.createElement('button');
    ballBtn.type = 'button';
    ballBtn.className = 'grid-number-btn';
    ballBtn.textContent = i;
    ballBtn.dataset.num = i;

    ballBtn.addEventListener('click', () => {
      if (selectedLottoNumbers.has(i)) {
        selectedLottoNumbers.delete(i);
        ballBtn.classList.remove('selected');
      } else {
        if (selectedLottoNumbers.size >= 7) {
          return showToast('최대 7개의 번호까지만 선택 가능합니다.');
        }
        selectedLottoNumbers.add(i);
        ballBtn.classList.add('selected');
      }
      selectedCountDisplay.textContent = selectedLottoNumbers.size;
    });

    lottoNumberGrid.appendChild(ballBtn);
  }
}

resetSelectedBallsBtn.addEventListener('click', () => {
  selectedLottoNumbers.clear();
  selectedCountDisplay.textContent = '0';
  document.querySelectorAll('.grid-number-btn').forEach(btn => btn.classList.remove('selected'));
});

lottoAutoBuyBtn.addEventListener('click', () => {
  if (currentUser.isGuest) return showToast('관전 모드에서는 응모할 수 없습니다.');
  socket.emit('buyLotto', { mode: 'AUTO' });
});

lottoManualBuyBtn.addEventListener('click', () => {
  if (currentUser.isGuest) return showToast('관전 모드에서는 응모할 수 없습니다.');
  if (selectedLottoNumbers.size !== 7) {
    return showToast('7개의 번호를 모두 선택해 주세요.');
  }
  socket.emit('buyLotto', {
    mode: 'MANUAL',
    numbers: Array.from(selectedLottoNumbers)
  });
});

socket.on('lottoSuccess', (data) => {
  currentUser.balance = data.balance;
  playerBalance.textContent = Number(data.balance).toLocaleString();
  showToast(`로또 [${data.mode}] 1회 응모 완료! (${data.numbers.join(', ')})`, true);
  renderMyLottoTickets(data.tickets);

  if (data.mode === '수동') {
    resetSelectedBallsBtn.click();
  }
});

function renderMyLottoTickets(tickets) {
  if (!myLottoList) return;
  myLottoList.innerHTML = '';
  if (!tickets || tickets.length === 0) {
    myLottoList.innerHTML = '<div class="empty-msg">응모한 로또 복권이 없습니다.</div>';
    return;
  }
  tickets.forEach(ticket => {
    const div = document.createElement('div');
    div.className = 'ticket-item';
    div.innerHTML = `<strong>제 ${ticket.round}회</strong>: [ ${ticket.numbers.split(',').join(' ')} ]`;
    myLottoList.appendChild(div);
  });
}

// --- 📈 주식 시장 상태 및 렌더링 ---
function updateMarketBadges(marketStatus) {
  if (!krMarketBadge || !usMarketBadge) return;
  krMarketBadge.textContent = marketStatus.krStatusText;
  krMarketBadge.className = marketStatus.isKrOpen ? 'market-badge open' : 'market-badge closed';

  usMarketBadge.textContent = marketStatus.usStatusText;
  usMarketBadge.className = marketStatus.isUsOpen ? 'market-badge open' : 'market-badge closed';
}

function renderStocks(stocksData) {
  if (!stocksTableBody) return;
  stocksTableBody.innerHTML = '';

  stocksData.forEach(stock => {
    const tr = document.createElement('tr');
    const isUp = stock.change >= 0;
    const changeClass = isUp ? 'price-up' : 'price-down';
    const sign = isUp ? '+' : '';
    const btnDisabled = currentUser.isGuest ? 'disabled-btn' : '';

    const isOpen = stock.isUs ? currentMarketStatus.isUsOpen : currentMarketStatus.isKrOpen;
    const statusText = isOpen
      ? '<span class="status-tag open">개장 (실시간)</span>'
      : '<span class="status-tag closed">마감 (예약 주문)</span>';

    const buyText = isOpen ? '매수' : '예약 매수';
    const sellText = isOpen ? '매도' : '예약 매도';

    tr.innerHTML = `
      <td>${stock.code}</td>
      <td><strong>${stock.name}</strong></td>
      <td>${stock.price.toLocaleString()} 원</td>
      <td class="${changeClass}">${sign}${stock.change}%</td>
      <td>${statusText}</td>
      <td>
        <button class="btn-trade-buy ${btnDisabled}" onclick="handleStockTrade('BUY', '${stock.code}', ${isOpen})">${buyText}</button>
        <button class="btn-trade-sell ${btnDisabled}" onclick="handleStockTrade('SELL', '${stock.code}', ${isOpen})">${sellText}</button>
      </td>
    `;
    stocksTableBody.appendChild(tr);
  });
}

window.handleStockTrade = function(type, code, isOpen) {
  if (currentUser.isGuest) return showToast('관전 모드에서는 거래할 수 없습니다.');
  const actionName = isOpen ? (type === 'BUY' ? '실시간 매수' : '실시간 매도') : (type === 'BUY' ? '장마감 예약 매수' : '장마감 예약 매도');
  const qtyStr = prompt(`${actionName}할 주식 수량을 입력하세요:`, '1');
  if (!qtyStr) return;
  const quantity = parseInt(qtyStr, 10);
  if (isNaN(quantity) || quantity <= 0) return showToast('올바른 수량을 입력하세요.');

  socket.emit('tradeStock', { type, code, quantity });
};

window.cancelOrder = function(orderId, code) {
  if (confirm('해당 예약 주문을 취소하시겠습니까?')) {
    socket.emit('cancelOrder', { orderId, code });
  }
};

socket.on('stockUpdate', (data) => {
  currentMarketStatus = data.marketStatus || currentMarketStatus;
  updateMarketBadges(currentMarketStatus);
  renderStocks(data.stocks);
});

socket.on('stockTradeSuccess', (data) => {
  currentUser.balance = data.balance;
  playerBalance.textContent = Number(data.balance).toLocaleString();
  showToast(data.message, true);
  renderMyStocks(data.userStocks);
  renderMyOrders(data.pendingOrders);
});

socket.on('orderExecuted', (data) => {
  currentUser.balance = data.balance;
  playerBalance.textContent = Number(data.balance).toLocaleString();
  showToast(data.message, true);
  renderMyStocks(data.userStocks);
  renderMyOrders(data.pendingOrders);
});

function renderMyOrders(orders) {
  if (!myOrdersTableBody) return;
  myOrdersTableBody.innerHTML = '';

  if (!orders || orders.length === 0) {
    myOrdersTableBody.innerHTML = '<tr><td colspan="6" class="empty-msg">대기 중인 예약 주문이 없습니다.</td></tr>';
    return;
  }

  orders.forEach(o => {
    const tr = document.createElement('tr');
    const typeLabel = o.type === 'BUY' ? '<strong style="color: #ef4444;">예약 매수</strong>' : '<strong style="color: #3b82f6;">예약 매도</strong>';

    tr.innerHTML = `
      <td>#${o.id}</td>
      <td>${o.name} (${o.code})</td>
      <td>${typeLabel}</td>
      <td>${o.quantity} 주</td>
      <td><span class="status-tag pending">개장 대기 중</span></td>
      <td><button class="btn-cancel-order" onclick="cancelOrder(${o.id}, '${o.code}')">주문 취소</button></td>
    `;
    myOrdersTableBody.appendChild(tr);
  });
}

function renderMyStocks(userStocks) {
  if (!myStocksTableBody) return;
  myStocksTableBody.innerHTML = '';
  if (!userStocks || userStocks.length === 0) {
    myStocksTableBody.innerHTML = '<tr><td colspan="4" class="empty-msg">보유 중인 주식이 없습니다.</td></tr>';
    return;
  }
  userStocks.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.name} (${s.code})</td>
      <td>${s.quantity} 주</td>
      <td>${Math.round(s.avgPrice).toLocaleString()} 원</td>
      <td><button class="btn-trade-sell" onclick="handleStockTrade('SELL', '${s.code}', true)">전량/일부 매도</button></td>
    `;
    myStocksTableBody.appendChild(tr);
  });
}

// --- 👑 관리자 패널 ---
if (adminRefreshUsersBtn) {
  adminRefreshUsersBtn.addEventListener('click', () => {
    socket.emit('adminGetUsers');
  });
}

socket.on('adminUsersList', (payload) => {
  if (!adminUsersTableBody) return;
  adminUsersTableBody.innerHTML = '';

  const users = payload.users || payload;
  const myRole = payload.myRole || currentUser.role;

  if (!users || users.length === 0) {
    adminUsersTableBody.innerHTML = '<tr><td colspan="7" class="empty-msg">등록된 회원이 없습니다.</td></tr>';
    return;
  }

  users.forEach(u => {
    const tr = document.createElement('tr');
    let roleBadge = '<span class="mode-tag member">USER</span>';
    if (u.role === 'ADMIN') roleBadge = '<span class="mode-tag admin-tag">ADMIN</span>';
    else if (u.role === 'SUBADMIN') roleBadge = '<span class="mode-tag subadmin-tag">SUBADMIN</span>';

    const createdAt = new Date(u.createdAt).toLocaleDateString('ko-KR');

    tr.innerHTML = `
      <td>${u.id}</td>
      <td><strong>${u.username}</strong></td>
      <td>${u.nickname}</td>
      <td class="price-up">${Number(u.balance).toLocaleString()} 원</td>
      <td>${roleBadge}</td>
      <td>${createdAt}</td>
      <td>
        <button class="btn-edit-user" onclick="openUserEditModal(${u.id}, '${u.username}', '${u.nickname}', ${u.balance}, '${u.role}')">⚙️ 관리 패널</button>
      </td>
    `;
    adminUsersTableBody.appendChild(tr);
  });
});

window.openUserEditModal = function(id, username, nickname, balance, role) {
  editUserId.value = id;
  editUsername.value = username;
  editNickname.value = nickname;
  editBalance.value = balance;
  editPassword.value = '';
  editRole.value = role;

  if (currentUser.role === 'ADMIN') {
    editRoleGroup.classList.remove('hidden');
    modalDeleteBtn.classList.remove('hidden');
  } else {
    editRoleGroup.classList.add('hidden');
    modalDeleteBtn.classList.add('hidden');
  }

  adminUserModal.classList.remove('hidden');
};

function closeUserEditModal() {
  adminUserModal.classList.add('hidden');
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeUserEditModal);
if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeUserEditModal);

adminUserEditForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const userId = editUserId.value;
  const newNickname = editNickname.value.trim();
  const newBalance = parseFloat(editBalance.value);
  const newPassword = editPassword.value.trim();
  const newRole = editRole.value;

  const updateData = {
    nickname: newNickname,
    balance: newBalance
  };

  if (newPassword !== '') updateData.password = newPassword;
  if (currentUser.role === 'ADMIN') updateData.role = newRole;

  socket.emit('adminUpdateUser', { userId, updateData });
  closeUserEditModal();
});

modalDeleteBtn.addEventListener('click', () => {
  const userId = editUserId.value;
  const username = editUsername.value;

  if (username === 'adminmaker') {
    return showToast('최고 관리자 계정은 삭제할 수 없습니다.');
  }

  const confirmMsg = `⚠️ 정말로 [${username}] 회원을 영구 삭제하시겠습니까?`;
  if (confirm(confirmMsg)) {
    socket.emit('adminDeleteUser', { userId });
    closeUserEditModal();
  }
});

socket.on('adminSuccess', (data) => {
  showToast(data.message, true);
});

// --- 🎮 AI 상대 대전 ---
document.querySelectorAll('.btn-ai-choice').forEach(btn => {
  btn.addEventListener('click', () => {
    if (currentUser.isGuest) return showToast('관전 모드에서는 참여할 수 없습니다.');
    const choice = btn.dataset.choice;
    const betAmount = parseInt(aiRpsBetAmount.value, 10);
    if (!betAmount || betAmount <= 0) return showToast('배팅 금액을 확인하세요.');

    socket.emit('playAiRps', { choice, betAmount });
  });
});

socket.on('aiRpsResult', (data) => {
  aiMyChoice.textContent = data.playerChoice;
  aiBotChoice.textContent = data.aiChoice;
  currentUser.balance = data.balance;
  playerBalance.textContent = Number(data.balance).toLocaleString();

  if (data.result === 'win') {
    aiRpsResult.textContent = `🎉 승리! AI(${data.aiChoice})를 이겼습니다! (+${data.reward.toLocaleString()}원)`;
    aiRpsResult.style.color = '#34d399';
    showToast(`승리! +${data.reward.toLocaleString()}원 획득!`, true);
  } else if (data.result === 'draw') {
    aiRpsResult.textContent = `🤝 무승부! AI(${data.aiChoice})와 비겼습니다. (배팅금 환급)`;
    aiRpsResult.style.color = '#fbbf24';
    showToast('무승부입니다. 배팅금이 전액 반환됩니다.', true);
  } else {
    aiRpsResult.textContent = `😢 패배! AI(${data.aiChoice})에게 졌습니다.`;
    aiRpsResult.style.color = '#ef4444';
    showToast('패배했습니다.');
  }
});

// --- 🎮 복권 & 도박 ---
document.querySelectorAll('.btn-scratch-buy').forEach(btn => {
  btn.addEventListener('click', () => {
    if (currentUser.isGuest) return showToast('관전 모드에서는 구매할 수 없습니다.');
    const price = parseInt(btn.dataset.price, 10);
    socket.emit('buyScratch', { price });
  });
});

socket.on('scratchResult', (data) => {
  const card = document.querySelector(`.scratch-card[data-price="${data.price}"]`);
  if (card) {
    const slot = card.querySelector('.scratch-slot');
    slot.textContent = data.icons;
    if (data.isWin) {
      showToast(`🎉 당첨! 당첨금 +${data.winAmount.toLocaleString()}원 획득!`, true);
    } else {
      showToast('낙첨되었습니다. 다음 기회에!');
    }
  }
  currentUser.balance = data.balance;
  playerBalance.textContent = Number(data.balance).toLocaleString();
});

if (dicePercentSlider) {
  dicePercentSlider.addEventListener('input', () => {
    const val = dicePercentSlider.value;
    dicePercentLabel.textContent = `${val}%`;
    const mult = (100 / val).toFixed(2);
    diceWinRateDisplay.textContent = `당첨 확률: ${val}% (배당률 ${mult}배)`;
  });
}

if (diceRollBtn) {
  diceRollBtn.addEventListener('click', () => {
    if (currentUser.isGuest) return showToast('관전 모드에서는 참여할 수 없습니다.');
    const amount = parseInt(diceBetInput.value, 10);
    const targetPercent = parseInt(dicePercentSlider.value, 10);
    if (!amount || amount <= 0) return showToast('배팅 금액을 입력해 주세요.');

    socket.emit('playDice', { amount, targetPercent });
  });
}

socket.on('diceResult', (data) => {
  diceRollValue.textContent = `${data.roll}`;
  currentUser.balance = data.balance;
  playerBalance.textContent = Number(data.balance).toLocaleString();

  if (data.isWin) {
    showToast(`🎉 당첨! (주사위: ${data.roll} <= ${data.targetPercent}%) +${data.reward.toLocaleString()}원 획득!`, true);
  } else {
    showToast(`😢 낙첨 (주사위: ${data.roll} > ${data.targetPercent}%)`);
  }
});

socket.on('gameError', (data) => {
  showToast(data.message);
});

// 정보 수정 버튼 클릭 시 모달 열기
if (btnUserProfile) {
  btnUserProfile.addEventListener('click', () => {
    if (currentUser.isGuest) return showToast('게스트는 이용할 수 없습니다.');
    profileNewNickname.value = currentUser.nickname || '';
    profileCurrentPassword.value = '';
    profileNewPassword.value = '';
    profileConfirmPassword.value = '';
    
    // 비밀번호 입력창 초기화 (숨김 상태)
    isPasswordEditMode = false;
    if (passwordSection) {
      passwordSection.style.display = 'none';
      passwordSection.classList.add('hidden');
    }
    if (togglePasswordBtn) {
      togglePasswordBtn.textContent = '🔒 비밀번호 변경하기';
    }

    userProfileModal.classList.remove('hidden');
  });
}

// 비밀번호 변경 토글 버튼 클릭
if (togglePasswordBtn) {
  togglePasswordBtn.onclick = function(e) {
    e.preventDefault();
    isPasswordEditMode = !isPasswordEditMode;

    if (isPasswordEditMode) {
      passwordSection.classList.remove('hidden');
      passwordSection.style.display = 'flex';
      togglePasswordBtn.textContent = '🔓 비밀번호 변경 취소';
    } else {
      passwordSection.style.display = 'none';
      passwordSection.classList.add('hidden');
      togglePasswordBtn.textContent = '🔒 비밀번호 변경하기';
      profileCurrentPassword.value = '';
      profileNewPassword.value = '';
      profileConfirmPassword.value = '';
    }
  };
}

function closeUserProfileModal() {
  if (userProfileModal) userProfileModal.classList.add('hidden');
}

if (closeProfileModalBtn) closeProfileModalBtn.addEventListener('click', closeUserProfileModal);
if (cancelProfileModalBtn) cancelProfileModalBtn.addEventListener('click', closeUserProfileModal);

// 저장 및 적용 제출
if (userProfileForm) {
  userProfileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const newNickname = profileNewNickname.value.trim();
    const currentPassword = profileCurrentPassword.value.trim();
    const newPassword = profileNewPassword.value.trim();
    const confirmPassword = profileConfirmPassword.value.trim();

    let requestData = { newNickname };

    // 비밀번호 변경 모드가 켜져 있는 경우에만 검증 수행
    if (isPasswordEditMode) {
      if (!currentPassword) {
        return showToast('현재 비밀번호를 입력해 주세요.');
      }
      if (!newPassword) {
        return showToast('새 비밀번호를 입력해 주세요.');
      }
      if (newPassword.length < 6) {
        return showToast('새 비밀번호는 최소 6자 이상이어야 합니다.');
      }
      if (newPassword !== confirmPassword) {
        return showToast('새 비밀번호가 일치하지 않습니다. 다시 확인해 주세요.');
      }
      requestData.currentPassword = currentPassword;
      requestData.newPassword = newPassword;
    }

    socket.emit('updateProfile', requestData);
  });
}

socket.on('profileUpdated', (data) => {
  showToast(data.message, true);
  currentUser.nickname = data.nickname;
  playerDisplay.textContent = `${data.nickname} 님`;
  if (aiPlayerNameDisplay) aiPlayerNameDisplay.textContent = data.nickname;
  closeUserProfileModal();
});