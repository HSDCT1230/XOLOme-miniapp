Component({
  properties: {
    orders: {
      type: Object,
      value: {}
    },
    stageIndex: {
      type: Number,
      value: 0
    }
  },

  data: {
    stages: [
      { key: 'deposit', name: '体验资格', amount: '¥499' },
      { key: 'confirmation', name: '确认购买', amount: '¥1,499' },
      { key: 'final', name: '尾款', amount: '¥3,000' },
      { key: 'ship', name: '发货', amount: '' }
    ]
  }
});
