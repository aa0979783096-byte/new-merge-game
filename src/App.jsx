import { useState, useRef } from 'react'
import './App.css'

const GRID_SIZE = 10

// ========== 唯一合法卡片白名單 ==========
const CARDS = {
  // 🧠 自我
  '休息': { level: 'L1', source: '自我', emoji: '🛌', next: '放鬆' },
  '放鬆': { level: 'L2', source: '自我', emoji: '😌', next: '心靈平衡' },
  '心靈平衡': { level: 'L3', source: '自我', emoji: '🧘', next: null },
  '情緒低落': { level: 'L4', source: '自我', emoji: '🖤', next: null },

  // 📚 課業
  '講義': { level: 'L1', source: '課業', emoji: '📄', next: '準備' },
  '準備': { level: 'L2', source: '課業', emoji: '📘', next: '自信' },
  '自信': { level: 'L3', source: '課業', emoji: '🧠', next: null },
  '課業壓力': { level: 'L4', source: '課業', emoji: '🖤', next: null },

  // 👨‍👩‍👦 家庭
  '父母': { level: 'L1', source: '家庭', emoji: '👪', next: '理解' },
  '理解': { level: 'L2', source: '家庭', emoji: '🤝', next: '支持' },
  '支持': { level: 'L3', source: '家庭', emoji: '🏡', next: null },
  '家庭壓力': { level: 'L4', source: '家庭', emoji: '🖤', next: null },
}

// ========== 來源配置（抽卡機率） ==========
const SOURCES = [
  {
    id: 'self',
    name: '🧠 自我',
    cards: [
      { name: '休息', rate: 0.60 },
      { name: '放鬆', rate: 0.30 },
      { name: '心靈平衡', rate: 0.02 },
      { name: '情緒低落', rate: 0.08 },
    ]
  },
  {
    id: 'study',
    name: '📚 課業',
    cards: [
      { name: '講義', rate: 0.60 },
      { name: '準備', rate: 0.30 },
      { name: '自信', rate: 0.02 },
      { name: '課業壓力', rate: 0.08 },
    ]
  },
  {
    id: 'family',
    name: '👨‍👩‍👦 家庭',
    cards: [
      { name: '父母', rate: 0.60 },
      { name: '理解', rate: 0.30 },
      { name: '支持', rate: 0.02 },
      { name: '家庭壓力', rate: 0.08 },
    ]
  },
]

// ========== 負面卡消除條件 ==========
const NEGATIVE_CLEAR_CONDITIONS = {
  '情緒低落': [
    { cards: ['放鬆', '放鬆', '放鬆'] },
    { cards: ['心靈平衡'] }
  ],
  '課業壓力': [
    { cards: ['準備', '準備', '準備'] },
    { cards: ['自信'] }
  ],
  '家庭壓力': [
    { cards: ['理解', '理解', '理解'] },
    { cards: ['支持'] }
  ]
}

// ========== 訂單池（每張訂單至少 3 張卡）==========
const ORDER_POOL = [
  { id: 1, title: '《硬撐讀書夜》', required: { '準備': 2, '放鬆': 1 }, reality: 5, mental: -10 },
  { id: 2, title: '《先顧好自己》', required: { '放鬆': 2, '講義': 1 }, reality: -10, mental: 5 },
  { id: 3, title: '《跟家裡講清楚》', required: { '理解': 2, '講義': 1 }, reality: -5, mental: 5 },
  { id: 4, title: '《把話吞下去繼續拼》', required: { '講義': 2, '理解': 1 }, reality: 5, mental: -5 },
  { id: 5, title: '《暫停一下再出發》', required: { '休息': 2, '準備': 1 }, reality: -5, mental: 5 },
  { id: 6, title: '《衝刺週計畫》', required: { '準備': 2, '講義': 2 }, reality: 10, mental: -5 },
  { id: 7, title: '《被支持的一天》', required: { '支持': 1, '理解': 2, '放鬆': 1 }, reality: -5, mental: 10 },
  { id: 8, title: '《穩住不崩》', required: { '自信': 1, '放鬆': 2, '準備': 1 }, reality: 10, mental: 0 },
  { id: 9, title: '《真的撐過去了》', required: { '心靈平衡': 1, '自信': 1, '支持': 1, '準備': 1, '放鬆': 1 }, reality: 10, mental: 5 },
  { id: 10, title: '《月末爆發（全都要）》', required: { '準備': 2, '放鬆': 2, '理解': 1 }, reality: 15, mental: 0 },
]

// 初始化空格子
const createEmptyGrid = () => {
  return Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(null))
}

// 生成隨機訂單（3~5 個）
const generateOrders = () => {
  const count = Math.floor(Math.random() * 3) + 3 // 3~5
  const shuffled = [...ORDER_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// 計算格子上的負面卡數量
const countNegativeCardsInGrid = (grid) => {
  let count = 0
  for (let row = 0; row < GRID_SIZE; row++) {
    for (let col = 0; col < GRID_SIZE; col++) {
      const card = grid[row][col]
      if (card && CARDS[card.type]?.level === 'L4') {
        count++
      }
    }
  }
  return count
}

function App() {
  const [steps, setSteps] = useState(30)
  const [reality, setReality] = useState(50)
  const [mental, setMental] = useState(50)
  const [grid, setGrid] = useState(createEmptyGrid())
  const [orders, setOrders] = useState(generateOrders())
  const [round, setRound] = useState(1)
  const [gameOver, setGameOver] = useState(false)
  const [deathReason, setDeathReason] = useState(null)

  // 拖曳與選取狀態
  const [dragging, setDragging] = useState(null)
  const [selectedNegative, setSelectedNegative] = useState(null)
  const [selectedPositives, setSelectedPositives] = useState([])
  const nextCardId = useRef(1)

  // Clamp 數值到 0-100
  const clamp = (value) => Math.max(0, Math.min(100, value))

  // 找所有空格
  const findEmptyCells = () => {
    const empty = []
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        if (grid[row][col] === null) {
          empty.push({ row, col })
        }
      }
    }
    return empty
  }

  // 生成卡片（按來源機率抽取）
  const generateCard = (sourceId) => {
    if (steps <= 0) {
      alert('步數不足！')
      return
    }

    const emptyCells = findEmptyCells()
    if (emptyCells.length === 0) {
      alert('格子已滿，無法生成')
      return
    }

    const sourceData = SOURCES.find(s => s.id === sourceId)
    if (!sourceData) return

    // 按累積機率抽取卡片
    const rand = Math.random()
    let cumulative = 0
    let selectedCard = null

    for (const card of sourceData.cards) {
      cumulative += card.rate
      if (rand < cumulative) {
        selectedCard = card.name
        break
      }
    }

    if (!selectedCard || !CARDS[selectedCard]) {
      console.error(`卡片 ${selectedCard} 不在白名單中`)
      return
    }

    // 隨機選一個空格
    const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)]

    const newGrid = grid.map(row => [...row])
    newGrid[randomCell.row][randomCell.col] = {
      id: nextCardId.current++,
      type: selectedCard,
    }

    setGrid(newGrid)
    setSteps(steps - 1)
  }

  // 開始拖曳
  const handleMouseDown = (e, row, col) => {
    const card = grid[row][col]
    if (!card) return

    setDragging({ row, col, card })
  }

  // 結束拖曳（合成）
  const handleMouseUp = (e, targetRow, targetCol) => {
    if (!dragging) return

    const sourceCard = grid[dragging.row][dragging.col]
    const targetCard = grid[targetRow][targetCol]

    // 拖到同一個格子 - 取消
    if (dragging.row === targetRow && dragging.col === targetCol) {
      setDragging(null)
      return
    }

    const newGrid = grid.map(row => [...row])
    const sourceCardData = CARDS[sourceCard.type]

    // 負面卡不可拖曳合成
    if (sourceCardData.level === 'L4') {
      alert('負面卡不可移動或合成！')
      setDragging(null)
      return
    }

    // 目標格子是空的 - 移動（不消耗步數）
    if (!targetCard) {
      newGrid[targetRow][targetCol] = sourceCard
      newGrid[dragging.row][dragging.col] = null
      setGrid(newGrid)
      setDragging(null)
      return
    }

    // 目標格子有相同卡片 - 合成
    if (targetCard.type === sourceCard.type) {
      if (steps <= 0) {
        alert('步數不足！')
        setDragging(null)
        return
      }

      const nextType = sourceCardData.next
      if (nextType) {
        newGrid[dragging.row][dragging.col] = null
        newGrid[targetRow][targetCol] = {
          id: nextCardId.current++,
          type: nextType,
        }
        setGrid(newGrid)
        setSteps(steps - 1)
      } else {
        alert('這張卡片已經是最高級，無法再合成！')
      }
      setDragging(null)
      return
    }

    // 目標格子有不同卡片 - 交換位置（不消耗步數）
    newGrid[dragging.row][dragging.col] = targetCard
    newGrid[targetRow][targetCol] = sourceCard
    setGrid(newGrid)
    setDragging(null)
  }

  // 點擊卡片（負面卡選取系統）
  const handleCardClick = (row, col) => {
    const card = grid[row][col]
    if (!card) return

    const cardData = CARDS[card.type]

    // 點擊負面卡
    if (cardData.level === 'L4') {
      if (selectedNegative && selectedNegative.row === row && selectedNegative.col === col) {
        // 取消選取
        setSelectedNegative(null)
        setSelectedPositives([])
      } else {
        // 選取負面卡
        setSelectedNegative({ row, col, type: card.type })
        setSelectedPositives([])
      }
      return
    }

    // 點擊正向卡（當已選取負面卡時）
    if (selectedNegative) {
      const posIndex = selectedPositives.findIndex(p => p.row === row && p.col === col)

      if (posIndex >= 0) {
        // 取消選取這張正向卡
        setSelectedPositives(selectedPositives.filter((_, i) => i !== posIndex))
      } else {
        // 選取這張正向卡
        const newSelected = [...selectedPositives, { row, col, type: card.type }]
        setSelectedPositives(newSelected)

        // 檢查是否符合消除條件
        checkClearCondition(selectedNegative.type, newSelected)
      }
    }
  }

  // 檢查並執行消除
  const checkClearCondition = (negativeType, selectedCards) => {
    const conditions = NEGATIVE_CLEAR_CONDITIONS[negativeType]
    if (!conditions) return

    // 計算選中的卡片類型數量
    const selectedCount = {}
    selectedCards.forEach(card => {
      selectedCount[card.type] = (selectedCount[card.type] || 0) + 1
    })

    // 檢查是否符合任一條件
    const matched = conditions.some(condition => {
      const requiredCount = {}
      condition.cards.forEach(cardName => {
        requiredCount[cardName] = (requiredCount[cardName] || 0) + 1
      })

      // 檢查數量是否完全匹配
      return Object.keys(requiredCount).every(cardName =>
        selectedCount[cardName] === requiredCount[cardName]
      ) && Object.keys(selectedCount).length === Object.keys(requiredCount).length
    })

    if (matched) {
      if (steps <= 0) {
        alert('步數不足！')
        return
      }

      // 執行消除
      const newGrid = grid.map(row => [...row])

      // 移除負面卡
      newGrid[selectedNegative.row][selectedNegative.col] = null

      // 移除選中的正向卡
      selectedCards.forEach(card => {
        newGrid[card.row][card.col] = null
      })

      setGrid(newGrid)
      setSteps(steps - 1)
      setSelectedNegative(null)
      setSelectedPositives([])
      alert('消除成功！')
    }
  }

  // 檢查死亡
  const checkDeath = (newReality, newMental) => {
    if (newReality === 0) return '現實'
    if (newMental === 0) return '精神'
    return null
  }

  // 完成訂單
  const handleCompleteOrder = (order) => {
    // 檢查場上是否有足夠的卡片
    const cardCount = {}
    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const card = grid[row][col]
        if (card) {
          cardCount[card.type] = (cardCount[card.type] || 0) + 1
        }
      }
    }

    // 驗證是否滿足訂單需求
    for (const [cardType, requiredCount] of Object.entries(order.required)) {
      if ((cardCount[cardType] || 0) < requiredCount) {
        alert(`需要 ${requiredCount} 張 ${cardType}，但場上只有 ${cardCount[cardType] || 0} 張`)
        return
      }
    }

    // 移除使用的卡片
    const newGrid = grid.map(row => [...row])
    const toRemove = { ...order.required }

    for (let row = 0; row < GRID_SIZE; row++) {
      for (let col = 0; col < GRID_SIZE; col++) {
        const card = newGrid[row][col]
        if (card && toRemove[card.type] > 0) {
          newGrid[row][col] = null
          toRemove[card.type]--
        }
      }
    }

    // 完成訂單，更新數值
    let newReality = clamp(reality + order.reality)
    let newMental = clamp(mental + order.mental)

    // 回合結算：檢查剩餘負面卡並扣分
    const negativeCount = countNegativeCardsInGrid(newGrid)
    if (negativeCount > 0) {
      newReality = clamp(newReality - 10)
      newMental = clamp(newMental - 10)
      alert(`回合結束！場上仍有 ${negativeCount} 張負面卡，Reality 和 Mind 各 -10`)
    }

    setReality(newReality)
    setMental(newMental)

    // 檢查死亡
    const death = checkDeath(newReality, newMental)
    if (death) {
      setDeathReason(death)
      setGameOver(true)
      return
    }

    // 進入下一回合
    setRound(round + 1)
    setGrid(createEmptyGrid())
    setSteps(30)
    setOrders(generateOrders())
    setSelectedNegative(null)
    setSelectedPositives([])
  }

  // 重新開始
  const handleRestart = () => {
    setSteps(30)
    setReality(50)
    setMental(50)
    setGrid(createEmptyGrid())
    setOrders(generateOrders())
    setRound(1)
    setGameOver(false)
    setDeathReason(null)
    setDragging(null)
    setSelectedNegative(null)
    setSelectedPositives([])
    nextCardId.current = 1
  }

  // 遊戲結束畫面
  if (gameOver) {
    return (
      <div className="game">
        <div className="game-over-overlay">
          <div className="game-over-panel">
            <h1>遊戲結束</h1>
            <div className="death-message">
              {deathReason === '現實' && '現實層面全面崩盤...'}
              {deathReason === '精神' && '心理崩潰，精神撐不住了...'}
            </div>
            <div className="final-stats">
              <div className="final-stat">
                <span>📈 最終現實：</span>
                <span className={reality === 0 ? 'critical' : ''}>{reality}</span>
              </div>
              <div className="final-stat">
                <span>❤️ 最終精神：</span>
                <span className={mental === 0 ? 'critical' : ''}>{mental}</span>
              </div>
              <div className="final-stat">
                <span>🔄 遊玩回合：</span>
                <span>{round}</span>
              </div>
            </div>
            <button className="restart-btn" onClick={handleRestart}>
              🔄 重新開始
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="game">
      {/* 頂部狀態列 */}
      <div className="status-bar">
        <div className="stats">
          <div className="stat">
            <span>📈 Reality</span>
            <div className="progress-bar">
              <div className="progress" style={{ width: `${reality}%`, background: '#4caf50' }} />
            </div>
            <span>{reality}</span>
          </div>
          <div className="stat">
            <span>❤️ Mind</span>
            <div className="progress-bar">
              <div className="progress" style={{ width: `${mental}%`, background: '#f44336' }} />
            </div>
            <span>{mental}</span>
          </div>
        </div>
        <div className="round-info">回合 {round}</div>
        <div className="steps">剩餘步數: {steps}</div>
      </div>

      {/* 訂單區域 */}
      <div className="orders">
        {orders.map(order => (
          <div key={order.id} className="order" onClick={() => handleCompleteOrder(order)}>
            <div className="order-title">{order.title}</div>
            <div className="order-required">
              需要: {Object.entries(order.required).map(([card, count]) =>
                `${CARDS[card]?.emoji}${card} ×${count}`
              ).join(' + ')}
            </div>
            <div className="order-rewards">
              <span className={order.reality >= 0 ? 'positive' : 'negative'}>
                📈 {order.reality > 0 ? '+' : ''}{order.reality}
              </span>
              <span className={order.mental >= 0 ? 'positive' : 'negative'}>
                ❤️ {order.mental > 0 ? '+' : ''}{order.mental}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 來源按鈕 */}
      <div className="sources">
        {SOURCES.map(source => (
          <button
            key={source.id}
            onClick={() => generateCard(source.id)}
            disabled={steps <= 0}
            className="source-btn"
          >
            {source.name}
          </button>
        ))}
      </div>

      {/* 主要遊戲區域 */}
      <div className="game-area">
        <div className="canvas">
          {grid.map((row, rowIdx) => (
            <div key={rowIdx} className="grid-row">
              {row.map((cell, colIdx) => {
                const isDragging = dragging?.row === rowIdx && dragging?.col === colIdx
                const isNegative = cell && CARDS[cell.type]?.level === 'L4'
                const isSelectedNegative = selectedNegative?.row === rowIdx && selectedNegative?.col === colIdx
                const isSelectedPositive = selectedPositives.some(p => p.row === rowIdx && p.col === colIdx)

                return (
                  <div
                    key={colIdx}
                    className={`grid-cell ${cell ? 'has-card' : ''} ${isDragging ? 'dragging-source' : ''} ${isNegative ? 'negative-cell' : ''}`}
                    onMouseDown={(e) => handleMouseDown(e, rowIdx, colIdx)}
                    onMouseUp={(e) => handleMouseUp(e, rowIdx, colIdx)}
                    onClick={() => handleCardClick(rowIdx, colIdx)}
                  >
                    {cell && (
                      <div className={`card ${isDragging ? 'dragging' : ''} ${isNegative ? 'negative-card' : ''} ${isSelectedNegative || isSelectedPositive ? 'selected' : ''} card-${CARDS[cell.type]?.level}`}>
                        <div className="card-emoji">{CARDS[cell.type]?.emoji}</div>
                        <div className="card-text">{cell.type}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* 合成表與說明 */}
        <div className="merge-guide">
          <h3>📋 合成表</h3>
          <div className="merge-chains">
            <div className="chain-group">
              <div className="chain-title">🧠 自我</div>
              <div className="chain">🛌休息 + 🛌休息 → 😌放鬆</div>
              <div className="chain">😌放鬆 + 😌放鬆 → 🧘心靈平衡</div>
            </div>
            <div className="chain-group">
              <div className="chain-title">📚 課業</div>
              <div className="chain">📄講義 + 📄講義 → 📘準備</div>
              <div className="chain">📘準備 + 📘準備 → 🧠自信</div>
            </div>
            <div className="chain-group">
              <div className="chain-title">👨‍👩‍👦 家庭</div>
              <div className="chain">👪父母 + 👪父母 → 🤝理解</div>
              <div className="chain">🤝理解 + 🤝理解 → 🏡支持</div>
            </div>
          </div>

          <div className="merge-hint">
            <strong>🖤 負面卡消除</strong><br/>
            <small>
              • 情緒低落：3×放鬆 或 1×心靈平衡<br/>
              • 課業壓力：3×準備 或 1×自信<br/>
              • 家庭壓力：3×理解 或 1×支持<br/>
              <br/>
              💡 操作：先點負面卡→再點正向卡→符合條件自動消除
            </small>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
