Component({
  properties: {
    voucher: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', { voucher: this.properties.voucher });
    }
  }
});
