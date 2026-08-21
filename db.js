const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

// 관리자 계정 초기화
async function ensureAdminAccount() {
  const adminUsername = 'adminmaker';
  const existingAdmin = await prisma.user.findUnique({
    where: { username: adminUsername }
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('adminmaker1234', 10);
    await prisma.user.create({
      data: {
        username: adminUsername,
        password: hashedPassword,
        nickname: '최고관리자',
        role: 'ADMIN',
        balance: 1000000000000
      }
    });
    console.log('👑 [최고 관리자 계정 생성 완료] ID: adminmaker | PW: adminmaker1234');
  }
}

// 회원가입
async function registerUser(username, plainPassword, nickname) {
  if (!username || !plainPassword || !nickname) {
    throw new Error('아이디, 비밀번호, 닉네임을 모두 입력해 주세요.');
  }

  const cleanUsername = String(username).trim();
  const cleanNickname = String(nickname).trim();

  if (cleanUsername.toLowerCase() === 'adminmaker') {
    throw new Error('사용할 수 없는 관리자 아이디입니다.');
  }

  const existingUser = await prisma.user.findUnique({
    where: { username: cleanUsername }
  });

  if (existingUser) {
    throw new Error('이미 존재하는 아이디입니다.');
  }

  const passwordStr = String(plainPassword);
  const hashedPassword = await bcrypt.hash(passwordStr, 10);

  return await prisma.user.create({
    data: {
      username: cleanUsername,
      password: hashedPassword,
      nickname: cleanNickname,
      role: 'USER',
      balance: 1000000
    }
  });
}

// 로그인 검증
async function authenticateUser(username, plainPassword) {
  if (!username || !plainPassword) return null;

  const cleanUsername = String(username).trim();
  const user = await prisma.user.findUnique({
    where: { username: cleanUsername },
    include: {
      stocks: true,
      lottoTickets: true,
      orders: { where: { status: 'PENDING' } }
    }
  });

  if (!user) return null;

  const passwordStr = String(plainPassword);
  const isMatch = await bcrypt.compare(passwordStr, user.password);
  if (!isMatch) return null;

  return user;
}

// 잔액 변동
async function updateUserBalance(userId, amountDelta) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      balance: { increment: amountDelta }
    }
  });
}

// 즉시 매수 처리
async function buyStockDb(userId, code, name, quantity, price) {
  const totalCost = quantity * price;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.balance < totalCost) {
    throw new Error('잔액이 부족합니다.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { balance: { decrement: totalCost } }
  });

  const existingStock = await prisma.userStock.findFirst({
    where: { userId, code }
  });

  if (existingStock) {
    const newQty = existingStock.quantity + quantity;
    const newAvg = ((existingStock.avgPrice * existingStock.quantity) + totalCost) / newQty;
    await prisma.userStock.update({
      where: { id: existingStock.id },
      data: { quantity: newQty, avgPrice: newAvg }
    });
  } else {
    await prisma.userStock.create({
      data: {
        userId,
        code,
        name,
        quantity,
        avgPrice: price
      }
    });
  }

  return await getUserProfile(userId);
}

// 즉시 매도 처리 (수수료 0.05%)
async function sellStockDb(userId, code, quantity, price) {
  const stock = await prisma.userStock.findFirst({
    where: { userId, code }
  });

  if (!stock || stock.quantity < quantity) {
    throw new Error('보유 주식 수량이 부족합니다.');
  }

  const grossAmount = quantity * price;
  const netAmount = Math.floor(grossAmount * 0.9995);

  await prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: netAmount } }
  });

  if (stock.quantity === quantity) {
    await prisma.userStock.delete({ where: { id: stock.id } });
  } else {
    await prisma.userStock.update({
      where: { id: stock.id },
      data: { quantity: stock.quantity - quantity }
    });
  }

  return await getUserProfile(userId);
}

// --- 📌 예약 주문(마감 장 주문) 관련 함수 ---

// 예약 주문 등록
async function createStockOrderDb(userId, type, code, name, quantity, isUs, estimatedPrice) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('유저 정보를 찾을 수 없습니다.');

  if (type === 'BUY') {
    const totalCost = quantity * estimatedPrice;
    if (user.balance < totalCost) {
      throw new Error('예약 매수에 필요한 잔액이 부족합니다.');
    }
    // 예약 매수금 사전 동결(차감)
    await prisma.user.update({
      where: { id: userId },
      data: { balance: { decrement: totalCost } }
    });
  } else if (type === 'SELL') {
    const stock = await prisma.userStock.findFirst({ where: { userId, code } });
    if (!stock || stock.quantity < quantity) {
      throw new Error('예약 매도에 필요한 보유 주식 수량이 부족합니다.');
    }
  }

  await prisma.stockOrder.create({
    data: {
      userId,
      type,
      code,
      name,
      quantity,
      isUs,
      status: 'PENDING'
    }
  });

  return await getUserProfile(userId);
}

// 예약 주문 취소
async function cancelStockOrderDb(userId, orderId, estimatedPrice) {
  const order = await prisma.stockOrder.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== userId || order.status !== 'PENDING') {
    throw new Error('취소할 수 없는 예약 주문입니다.');
  }

  // 매수 예약 취소 시 묶였던 자금 환급
  if (order.type === 'BUY') {
    const refundAmount = order.quantity * estimatedPrice;
    await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: refundAmount } }
    });
  }

  await prisma.stockOrder.update({
    where: { id: orderId },
    data: { status: 'CANCELLED' }
  });

  return await getUserProfile(userId);
}

// 개장 시 대기 중인 예약 주문 자동 체결
async function processPendingOrdersDb(isUsMarket, currentStocksMap) {
  const pendingOrders = await prisma.stockOrder.findMany({
    where: {
      isUs: isUsMarket,
      status: 'PENDING'
    }
  });

  const executedResults = [];

  for (const order of pendingOrders) {
    const currentPrice = currentStocksMap[order.code];
    if (!currentPrice) continue;

    try {
      if (order.type === 'BUY') {
        const existingStock = await prisma.userStock.findFirst({
          where: { userId: order.userId, code: order.code }
        });
        const totalCost = order.quantity * currentPrice;

        if (existingStock) {
          const newQty = existingStock.quantity + order.quantity;
          const newAvg = ((existingStock.avgPrice * existingStock.quantity) + totalCost) / newQty;
          await prisma.userStock.update({
            where: { id: existingStock.id },
            data: { quantity: newQty, avgPrice: newAvg }
          });
        } else {
          await prisma.userStock.create({
            data: {
              userId: order.userId,
              code: order.code,
              name: order.name,
              quantity: order.quantity,
              avgPrice: currentPrice
            }
          });
        }
      } else if (order.type === 'SELL') {
        const stock = await prisma.userStock.findFirst({
          where: { userId: order.userId, code: order.code }
        });

        if (stock && stock.quantity >= order.quantity) {
          const netAmount = Math.floor((order.quantity * currentPrice) * 0.9995);
          await prisma.user.update({
            where: { id: order.userId },
            data: { balance: { increment: netAmount } }
          });

          if (stock.quantity === order.quantity) {
            await prisma.userStock.delete({ where: { id: stock.id } });
          } else {
            await prisma.userStock.update({
              where: { id: stock.id },
              data: { quantity: stock.quantity - order.quantity }
            });
          }
        }
      }

      await prisma.stockOrder.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' }
      });

      executedResults.push({
        userId: order.userId,
        order
      });
    } catch (e) {
      console.error(`[예약 주문 자동 체결 실패 Order#${order.id}]`, e.message);
    }
  }

  return executedResults;
}

// 로또 구매 저장
async function buyLottoTicketDb(userId, round, numbersStr, cost) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.balance < cost) {
    throw new Error('잔액이 부족합니다.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { balance: { decrement: cost } }
  });

  await prisma.lottoTicket.create({
    data: {
      userId,
      round,
      numbers: numbersStr
    }
  });

  return await getUserProfile(userId);
}

// 유저 프로필 조회
async function getUserProfile(userId) {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      stocks: true,
      lottoTickets: true,
      orders: { where: { status: 'PENDING' } }
    }
  });
}

// 전체 유저 목록 조회
async function getAllUsersDb() {
  return await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      nickname: true,
      role: true,
      balance: true,
      createdAt: true
    },
    orderBy: { id: 'asc' }
  });
}

// 유저 정보 수정
async function adminUpdateUserDb(executorRole, targetUserId, updateData) {
  const targetId = parseInt(targetUserId, 10);
  const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
  if (!targetUser) throw new Error('존재하지 않는 유저입니다.');

  if (targetUser.username === 'adminmaker' && executorRole !== 'ADMIN') {
    throw new Error('최고 관리자의 정보는 SUBADMIN이 변경할 수 없습니다.');
  }

  const data = {};
  if (updateData.nickname !== undefined) data.nickname = String(updateData.nickname).trim();
  if (updateData.balance !== undefined) data.balance = parseFloat(updateData.balance);

  if (updateData.password && String(updateData.password).trim() !== '') {
    data.password = await bcrypt.hash(String(updateData.password).trim(), 10);
  }

  if (updateData.role !== undefined) {
    if (executorRole !== 'ADMIN') {
      throw new Error('권한 변경은 최고 관리자(ADMIN)만 가능합니다.');
    }
    const roleUpper = String(updateData.role).trim().toUpperCase();
    if (!['USER', 'SUBADMIN', 'ADMIN'].includes(roleUpper)) {
      throw new Error('권한은 USER, SUBADMIN, ADMIN 중 하나여야 합니다.');
    }
    data.role = roleUpper;
  }

  return await prisma.user.update({
    where: { id: targetId },
    data: data
  });
}

// 계정 영구 삭제
async function adminDeleteUserDb(executorRole, targetUserId) {
  if (executorRole !== 'ADMIN') {
    throw new Error('계정 삭제는 최고 관리자(ADMIN)만 가능합니다.');
  }

  const targetId = parseInt(targetUserId, 10);
  const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
  if (!targetUser) throw new Error('존재하지 않는 유저입니다.');

  if (targetUser.username === 'adminmaker') {
    throw new Error('최고 관리자 계정은 삭제할 수 없습니다.');
  }

  await prisma.userStock.deleteMany({ where: { userId: targetId } });
  await prisma.lottoTicket.deleteMany({ where: { userId: targetId } });
  await prisma.stockOrder.deleteMany({ where: { userId: targetId } });

  return await prisma.user.delete({
    where: { id: targetId }
  });
}

async function updateProfileDb(userId, currentPassword, newNickname, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('유저를 찾을 수 없습니다.');

  if (user.role === 'ADMIN' || user.role === 'SUBADMIN') {
    throw new Error('관리자 계정은 이 메뉴에서 수정할 수 없습니다.');
  }

  // 비밀번호 검증 (프로젝트 해싱 방식에 맞춤: bcrypt 또는 crypto)
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) throw new Error('현재 비밀번호가 일치하지 않습니다.');

  const updateData = {};

  if (newNickname && newNickname.trim() !== '' && newNickname !== user.nickname) {
    const exist = await prisma.user.findFirst({
      where: { nickname: newNickname.trim(), id: { not: userId } }
    });
    if (exist) throw new Error('이미 사용 중인 닉네임입니다.');
    updateData.nickname = newNickname.trim();
  }

  if (newPassword && newPassword.trim() !== '') {
    if (newPassword.length < 6) throw new Error('새 비밀번호는 6자리 이상이어야 합니다.');
    updateData.password = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('변경할 내용을 입력해 주세요.');
  }

  return await prisma.user.update({
    where: { id: userId },
    data: updateData
  });
}

module.exports = {
  prisma,
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
  adminDeleteUserDb,
  updateProfileDb
};