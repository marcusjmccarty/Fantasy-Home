'use strict';
importScripts('analytics-math.js');
self.onmessage=event=>{const {own,their,slots,week,mode}=event.data;self.postMessage(FantasyMath.searchTrades(own,their,slots,week,mode));};
