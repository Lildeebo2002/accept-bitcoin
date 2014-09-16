// Generated by CoffeeScript 1.8.0
(function() {
  var Key, bitcore, crypt, ee, fs, request,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  bitcore = require('bitcore');

  crypt = require('./encrypt');

  fs = require('fs');

  request = require('request');

  ee = require('events').EventEmitter;

  Key = (function() {
    function Key(settings, publicKey, privateKeyWif) {
      this.settings = settings;
      this.publicKey = publicKey;
      this.privateKeyWif = privateKeyWif;
      this.transferBalanceToMyAccount = __bind(this.transferBalanceToMyAccount, this);
      this.payTo = __bind(this.payTo, this);
      this.transferPaymentHash = __bind(this.transferPaymentHash, this);
      this.checkUnspent = __bind(this.checkUnspent, this);
      this.checkBalance = __bind(this.checkBalance, this);
      this.readKeys = __bind(this.readKeys, this);
      this.storeKey = __bind(this.storeKey, this);
      this.printKey = __bind(this.printKey, this);
      this.privateKey = __bind(this.privateKey, this);
      this.address = __bind(this.address, this);
      this.wk = __bind(this.wk, this);
      ee.call(this);
      this.wk = new bitcore.WalletKey({
        network: this.settings.network === 'live' ? bitcore.networks.livenet : bitcore.networks.testnet
      });
      if (this.privateKeyWif) {
        this.wk.fromObj({
          priv: this.privateKeyWif
        });
      }
      if (!this.privateKeyWif) {
        this.wk.generate();
        this.storeKey();
      }
      this.printKey(this.wk);
    }

    Key.prototype.wk = function() {
      return this.wk;
    };

    Key.prototype.address = function() {
      return this.publicKey || this.wk.storeObj().addr;
    };

    Key.prototype.privateKey = function() {
      return this.privateKeyWif || this.wk.storeObj().priv;
    };

    Key.prototype.printKey = function(wk) {
      var wkObj;
      if (wk == null) {
        wk = this.wk;
      }
      if (this.publicKey && this.privateKeyWif) {
        return console.log("public: " + this.publicKey + " private: " + this.privateKeyWif);
      } else {
        console.log("## Network: " + wk.network.name);
        console.log("*** Hex Representation");
        console.log("Private: " + bitcore.buffertools.toHex(wk.privKey["private"]));
        console.log("Public : " + bitcore.buffertools.toHex(wk.privKey["public"]));
        console.log("Public Compressed : " + (wk.privKey.compressed ? "Yes" : "No"));
        wkObj = wk.storeObj();
        console.log("*** WalletKey Store Object");
        console.log("Private: " + wkObj.priv);
        console.log("Public : " + wkObj.pub);
        return console.log("Addr   : " + wkObj.addr);
      }
    };

    Key.prototype.storeKey = function(wk) {
      var privateKey, wkObj;
      if (wk == null) {
        wk = this.wk;
      }
      if (!this.settings.storePath) {
        return;
      }
      wkObj = wk.storeObj();
      privateKey = this.settings.encryptPrivateKey ? crypt.encrypt(this.privateKey(), this.settings.password) : this.privateKey();
      return fs.appendFileSync(this.settings.storePath, this.address() + "|" + privateKey + "\n");
    };

    Key.prototype.readKeys = function() {
      var lines;
      lines = fs.readFileSync(this.settings.storePath).toString().split("\n");
      return console.log(lines);
    };

    Key.prototype.checkBalance = function() {
      var checkBalanceInterval, checkBalanceTimeout;
      checkBalanceTimeout = setTimeout(function() {
        return this.emit('checkBalanceTimeout');
      }, this.settings.checkBalanceTimeout);
      return checkBalanceInterval = setInterval((function(_this) {
        return function() {
          console.log("checking balance for " + (_this.address()));
          return request.get("http://" + (_this.settings.network === bitcore.networks.testnet ? 't' : '') + "btc.blockr.io/api/v1/address/info/" + (_this.address()), function(error, response, body) {
            var _ref, _ref1;
            body = JSON.parse(body);
            if (body.status === 'success' && ((_ref = body.data) != null ? _ref.balance : void 0) > 0) {
              clearInterval(checkBalanceInterval);
              clearTimeout(checkBalanceTimeout);
              return _this.emit('hasBalance', (_ref1 = body.data) != null ? _ref1.balance : void 0);
            }
          });
        };
      })(this), this.settings.checkTransactionEvery);
    };

    Key.prototype.checkUnspent = function(cb) {
      var checkUnspentInterval, checkUnspentTimeout;
      checkUnspentTimeout = setTimeout(function() {
        clearInterval(checkUnspentInterval);
        if (cb) {
          return cb('checkUnspentTimeout');
        }
      }, this.settings.checkUnspentTimeout);
      return checkUnspentInterval = setInterval((function(_this) {
        return function() {
          console.log("checking unspents for " + (_this.address()));
          return request.get("http://" + (_this.settings.network === bitcore.networks.testnet ? 't' : '') + "btc.blockr.io/api/v1/address/unspent/" + (_this.address()) + (_this.settings.minimumConfirmations === 0 ? '?unconfirmed=1' : ''), function(error, response, body) {
            var tx, unspent, _ref, _ref1;
            body = JSON.parse(body);
            if (body.status === 'success' && ((_ref = body.data) != null ? (_ref1 = _ref.unspent) != null ? _ref1.length : void 0 : void 0) > 0) {
              unspent = (function() {
                var _i, _len, _ref2, _results;
                _ref2 = body.data.unspent;
                _results = [];
                for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
                  tx = _ref2[_i];
                  if (tx.confirmations >= this.settings.minimumConfirmations) {
                    _results.push(this.uotxToHash(tx));
                  }
                }
                return _results;
              }).call(_this);
              console.log(unspent.reduce((function(tot, o) {
                return tot + parseFloat(o.amount);
              }), 0));
              if (unspent.length > 0) {
                clearInterval(checkUnspentInterval);
                clearTimeout(checkUnspentTimeout);
                cb(null, unspent);
                return _this.emit('haveUnspent', unspent);
              }
            }
          }, _this.settings.checkTransactionEvery);
        };
      })(this));
    };

    Key.prototype.transferPaymentHash = function(payToAddress, o, cb) {
      if (o == null) {
        o = {};
      }
      if (!payToAddress) {
        return;
      }
      if (arguments.length === 2 && o instanceof Function) {
        cb = o;
        o = {};
      }
      return this.checkUnspent((function(_this) {
        return function(err, unspent) {
          var amount, fee, options, outs, tx, txHex;
          if (err) {
            cb(err);
          }
          fee = o.txFee || _this.settings.txFee;
          console.log('fee', fee);
          amount = o.amount || unspent.reduce((function(tot, o) {
            return tot + parseFloat(o.amount);
          }), 0 - fee);
          outs = [
            {
              address: payToAddress,
              amount: amount
            }
          ];
          options = {
            remainderOut: {
              address: o.payReminderToAddress || _this.settings.payReminderToAddress || _this.address()
            },
            fee: fee
          };
          console.log(options);
          tx = new bitcore.TransactionBuilder(options).setUnspent(unspent).setOutputs(outs).sign([_this.privateKey()]).build();
          console.log("Paying " + amount + " from " + (_this.address()) + " to " + payToAddress);
          txHex = tx.serialize().toString('hex');
          return cb(null, txHex);
        };
      })(this));
    };

    Key.prototype.payTo = function(payToAddress, o, cb) {
      if (o == null) {
        o = {};
      }
      if (cb == null) {
        cb = function() {};
      }
      if (!payToAddress) {
        return;
      }
      if (arguments.length === 2 && o instanceof Function) {
        cb = o;
        o = {};
      }
      return this.transferPaymentHash(payToAddress, o, (function(_this) {
        return function(err, hex) {
          if (err) {
            cb(err);
          }
          return request.post({
            url: "http://" + (_this.settings.network === bitcore.networks.testnet ? 't' : '') + "btc.blockr.io/api/v1/tx/push",
            json: {
              hex: hex
            }
          }, function(error, response, body) {
            return cb(err, body);
          });
        };
      })(this));
    };

    Key.prototype.transferBalanceToMyAccount = function(o, cb) {
      return this.payTo(this.settings.payToAddress, o, cb);
    };

    Key.prototype.uotxToHash = function(o) {
      return {
        txid: o.tx,
        vout: o.n,
        address: this.address(),
        scriptPubKey: o.script,
        amount: o.amount,
        confirmations: o.confirmations
      };
    };

    return Key;

  })();

  Key.prototype.__proto__ = ee.prototype;

  module.exports = Key;

}).call(this);