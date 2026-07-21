Component({
  properties: {
    question: {
      type: Object,
      value: {}
    },
    value: {
      type: null,
      value: null
    },
    index: {
      type: Number,
      value: 0
    }
  },

  methods: {
    onRadioTap(e) {
      const val = e.currentTarget.dataset.value;
      this.triggerEvent('change', { value: val });
    },

    onCheckboxTap(e) {
      const val = e.currentTarget.dataset.value;
      const current = Array.isArray(this.properties.value)
        ? [...this.properties.value]
        : [];
      const idx = current.indexOf(val);
      if (idx > -1) {
        current.splice(idx, 1);
      } else {
        current.push(val);
      }
      this.triggerEvent('change', { value: current });
    },

    onTextInput(e) {
      this.triggerEvent('change', { value: e.detail.value });
    }
  }
});
