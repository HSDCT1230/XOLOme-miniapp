Component({
  properties: {
    amount: {
      type: Number,
      value: 0
    },
    type: {
      type: String,
      value: 'DEPOSIT'
    },
    disabled: {
      type: Boolean,
      value: false
    },
    loading: {
      type: Boolean,
      value: false
    }
  },

  data: {
    typeLabels: {
      DEPOSIT: '体验资格',
      CONFIRMATION: '确认购买',
      FINAL: '尾款'
    },
    amountStr: '0.00'
  },

  lifetimes: {
    attached() {
      this.setData({
        amountStr: this.formatAmount(this.properties.amount)
      });
    }
  },

  observers: {
    'amount'(val) {
      this.setData({ amountStr: this.formatAmount(val) });
    }
  },

  methods: {
    formatAmount(cents) {
      if (!cents || cents <= 0) return '0.00';
      const yuan = (cents / 100).toFixed(2);
      const parts = yuan.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return parts.join('.');
    },

    onTap() {
      if (this.properties.disabled || this.properties.loading) return;
      this.triggerEvent('pay', {
        amount: this.properties.amount,
        type: this.properties.type
      });
    }
  }
});
