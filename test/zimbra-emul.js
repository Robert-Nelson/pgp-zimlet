ZmZimletBase = function () {
	this.id = "1";
};

ZmZimletBase.prototype.getResource = function (str) {
	return str;
};

ZmZimletBase.prototype.createApp = function (tabName, tabIcon, tabTooltip) {
	return tabName;
};

ZmMailMsg = function (str) {
	this.bodyPart = new ZmMimePart(str);
};

ZmMailMsg.prototype.getBodyPart = function (contentType, callback) {
	return callback(this.bodyPart);
};

ZmMimePart = function (str) {
	this.content = str;
};

ZmMimePart.prototype.getContent = function () {
	return this.content;
};

ZmMailMsgView = function () {
	this._htmlElId = 'msg_view';
	this._msgBodyDivId = 'msg_view_body';
};


ZmMimeTable = function () {
};

ZmMimeTable.TEXT_PLAIN = 1;

AjxCallback = function () {
};

AjxCallback.simpleClosure = function (func, obj) {
	 	var args = [];
		for (var i = 2; i < arguments.length; ++i)
			args.push(arguments[i]);
		return function() {
			var args2 = [];
			for (var i = 0; i < arguments.length; ++i)
				args2.push(arguments[i]);
			return func.apply(obj || this, args.concat(args2));
		};
};
