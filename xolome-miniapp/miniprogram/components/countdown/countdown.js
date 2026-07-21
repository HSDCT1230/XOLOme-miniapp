Component({
  properties: {
    deadline: {
      type: String,
      value: ''
    },
    label: {
      type: String,
      value: '退款窗口倒计时'
    }
  },

  data: {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false
  },

  lifetimes: {
    attached() {
      this.startTimer();
    },
    detached() {
      this.stopTimer();
    }
  },

  observers: {
    'deadline'(val) {
      if (val) {
        this.startTimer();
      }
    }
  },

  methods: {
    startTimer() {
      this.stopTimer();
      this.updateRemaining();
      this.timer = setInterval(() => {
        this.updateRemaining();
      }, 1000);
    },

    stopTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    },

    updateRemaining() {
      const { deadline } = this.properties;
      if (!deadline) return;

      const target = new Date(deadline).getTime();
      if (isNaN(target)) return;

      const now = Date.now();
      let diff = target - now;

      if (diff <= 0) {
        this.setData({
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          expired: true
        });
        this.stopTimer();
        return;
      }

      const days = Math.floor(diff / 86400000);
      diff -= days * 86400000;
      const hours = Math.floor(diff / 3600000);
      diff -= hours * 3600000;
      const minutes = Math.floor(diff / 60000);
      diff -= minutes * 60000;
      const seconds = Math.floor(diff / 1000);

      this.setData({
        days,
        hours,
        minutes,
        seconds,
        expired: false
      });
    }
  }
});
