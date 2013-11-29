/*

This file is responsible for all the Zimbra integration functions and everything
else that's done in the zimbra interface

TODO:
     => Button that links to my Github
     => Implement options via setUserProperty() and getUserProperty()

// List all properties in object
properties = appCtxt._zimletMgr._ZIMLETS_BY_ID['com_zimbra_pgp']._propsById
for(var i in properties) {
    if (properties.hasOwnProperty(i)) {
        console.log(i + " = " + properties[i].value);
    }
}


*/

/*
===== Declare a blank constructor, since we don't need one =====
*/
Com_Zimbra_PGP = function() {
};

/*
===== Build our prototype from our constructor and objectHandler =====
*/
Com_Zimbra_PGP.prototype = new ZmZimletBase;
Com_Zimbra_PGP.prototype.constructor = Com_Zimbra_PGP;

/*
===== Stupid convention, but may be used elsewhere =====
*/
Com_Zimbra_PGP.prototype.toString = 
function() {
    return "Com_Zimbra_PGP";
};

/*
===== Init functions (not needed really) =====
*/
Com_Zimbra_PGP.prototype.init = function() {
    //alert('Starting Zimlet');
    openpgp.init();
};

function showMessages(text) {
    console.log(text);
}

/*
===== Matches our PGP stuff, and calls the info bar function =====
===== *NOTE*: Runs multiple times for each message =====
                ======================
                ===== ENTRY POINT ====
                ======================
*/
Com_Zimbra_PGP.prototype.match = function(line, startIndex) {
    var header = false;
    if (line.search(/-----BEGIN PGP SIGNED MESSAGE-----/) != -1) {
        header = true;
    }
    if (header) {
        if (this.getUserProperty("ZimbraPGP_firstRun") == "false") {
            //alert('Not first run!');
        } else {
            this.setUserProperty("ZimbraPGP_firstRun","false",true);
            //alert('First run detected!')
            /*
               Do first run things 
            */
        }
        this.infoBar();
    }
    return null;
};


/*
===== Draws our initial info bar with the proper signature algorithm =====
*/
Com_Zimbra_PGP.prototype.infoBar = function() {
	// Determine if we have HTML5 or not
    if (typeof(window['localStorage']) == "object") {
        window._HTML5 = true;
    } else {
        window._HTML5 = false;
    }

	// Find our infoDiv
	this._infoDiv = document.getElementById(appCtxt.getCurrentView()._mailMsgView._infoBarId);

    var html = this.getFromTempCache(appCtxt.getCurrentView()._mailMsgView._msg.id);

    if (html == null) {
		// Find the message that we're clicked on.
		var msgText = appCtxt.getCurrentView()._mailMsgView._msg.getBodyPart();

		// Parse out our signature stuff and message text
		this._infoDiv.msg = openpgp.read_message(msgText.node.content);

		var pubkeyAlgo = this.getAlgorithmType(this._infoDiv.msg[0].signature.publicKeyAlgorithm);

        var values = {
            algo: pubkeyAlgo
        };

        var html = AjxTemplate.expand("com_zimbra_pgp.templates.pgp#infobar_verify", values);
	}

    // Make the bar visible
    this._infoDiv.innerHTML = html;
};

/*
===== Destroys the info bar =====
*/
Com_Zimbra_PGP.prototype.destroyInfoBar = function() {
    // Find our infoDiv
    this._infoDiv = document.getElementById(appCtxt.getCurrentView()._mailMsgView._infoBarId);
    this._infoDiv.innerHTML = "";
};


/*
===== Searches cache for key, if not found, ask about going online =====
*/
Com_Zimbra_PGP.prototype.searchForKey = function() {
    // Find our infoDiv
    this._infoDiv = document.getElementById(appCtxt.getCurrentView()._mailMsgView._infoBarId);
    
    // If this key is found in the cache
    var keyid = this._infoDiv.msg[0].signature.getIssuer();
    var keyList = openpgp.keyring.getPublicKeysForKeyId(keyid);
    if (keyList != null && keyList.length > 0) {
        this.msgVerify();
    // Otherwise, ask about going online
    } else {   
        this.askSearch(); 
    }
};

Com_Zimbra_PGP.prototype.storeInTempCache = function(msgId, HTML) {
    // If we have the necessary sessionStorage object
    if (window._HTML5) {
        sessionStorage.setItem(msgId, escape(HTML));
    } else {
        // By default cookies are all session
        document.cookie = 'PGPVerified_' + msgId +'='+ escape(HTML)
    }
};

Com_Zimbra_PGP.prototype.getFromTempCache = function(msgId) {
    // If we have the necessary localStorage object
    if (window._HTML5) {
        msgHTML = sessionStorage.getItem(msgId);
        if (msgHTML != null) {
            msgHTML = unescape(msgHTML);
        }
        return msgHTML;
    } else {
        var cookies = document.cookie.split(';');        
        var pgpCookies = new Array();       
        for (i=0;i<cookies.length;i++) { 
            // Populate our pgpCookies array with the pointers to the cookies we want
            if (cookies[i].indexOf('PGPVerified_') != -1) {
                pgpCookies.push(i);
            }
        }
        // For each PGP cookie
        for (i=0;i<pgpCookies.length;i++) {     
            if (cookies[pgpCookies[i]].replace(/^\s/,'').split('=')[0] === "PGPVerified_" + msgId) {
                // Delicious cookies
                msgHTML = unescape(cookies[pgpCookies[i]].replace(/^\s/,'').split('=')[1]);
                return msgHTML;
            }
        }
        return null;
    }    
};

/*
===== Confirm it's alright to go online =====
*/
Com_Zimbra_PGP.prototype.askSearch = function() {
    // Get our new DWT widget window refrence
    this._dialog = appCtxt.getYesNoMsgDialog(); 
    // Message
    var errMsg = "Could not find public key in the cache, search pgp.mit.edu for it?";
    // Just a warning, not critical 
    // see http://wiki.zimbra.com/wiki/ZCS_6.0:Zimlet_Developers_Guide:Examples:Dialogs#Screenshots
    var style = DwtMessageDialog.INFO_STYLE;

    // set the button listeners up to the proper callbacks
    this._dialog.setButtonListener(DwtDialog.YES_BUTTON, new AjxListener(this, this._searchBtnListener));
    this._dialog.setButtonListener(DwtDialog.NO_BUTTON, new AjxListener(this, this._clrBtnListener)); 

    // Reset state to a known state
    this._dialog.reset();
    // Pop in the message
    this._dialog.setMessage(errMsg,style);
    // and pop it up!
    this._dialog.popup();
};

/*
===== This searches the interwebs for a suitable public key =====
*/
Com_Zimbra_PGP.prototype._searchBtnListener = function(obj){
    // Find our infoDiv
    this._infoDiv = document.getElementById(appCtxt.getCurrentView()._mailMsgView._infoBarId);
    // Clear our popup
    this._dialog.popdown();
    // Get our infoDiv location
    this._infoDiv = document.getElementById(appCtxt.getCurrentView()._mailMsgView._infoBarId);
    // Create a new temporary div to populate with our response so we can navigate it easier, and hide it.
    var temp_div = document.createElement('div');
    // Talk to the JSP page to lookup the keyid parsed from the signature
    var keyid = this._infoDiv.msg[0].signature.getIssuer();
    var response = AjxRpc.invoke(null, '/service/zimlet/com_zimbra_pgp/lookup.jsp?key=0x'+util.hexstrdump(keyid).substring(8), null, null, true);
    // If we don't have a null response
    if (response.text !== "" && response.txt !== "No email specified") {
        // If the key was found, 
        temp_div.innerHTML = response.text;
        var keytext = temp_div.getElementsByTagName('pre')[0].innerHTML;
        openpgp.keyring.importPublicKey(keytext);
        this.msgVerify();
    } else {
        // If no key was found, error out and display the problem. 
        // Will update so manual key entry is possible later. 
        this.askManualEntry();
    }
};

/*
===== This asks about entering a key in manually, and stores it in the cache =====
*/
Com_Zimbra_PGP.prototype.askManualEntry = function(obj){
    // Get our new DWT widget window refrence
    this._dialog = appCtxt.getYesNoMsgDialog(); 
    // Message
    var errMsg = "Could not find the key on pgp.mit.edu, enter it manually?";
    // Just a warning, not critical 
    var style = DwtMessageDialog.INFO_STYLE;

    // set the button listeners up to the proper callbacks
    this._dialog.setButtonListener(DwtDialog.YES_BUTTON, new AjxListener(this, this.manualKeyEntry));
    this._dialog.setButtonListener(DwtDialog.NO_BUTTON, new AjxListener(this, this._clrBtnListener)); 

    // Reset state to a known state
    this._dialog.reset();
    // Pop in the message
    this._dialog.setMessage(errMsg,style);
    // and pop it up!
    this._dialog.popup();
};

/*
===== This is the function responsible for verify the message itself and calling the proper bar =====
*/
Com_Zimbra_PGP.prototype.msgVerify = function() {
    // Find our infoDiv
    this._infoDiv = document.getElementById(appCtxt.getCurrentView()._mailMsgView._infoBarId);

    var signature = this._infoDiv.msg[0].signature;
    var keyList = openpgp.keyring.getPublicKeysForKeyId(signature.getIssuer());
    var id = "0x" + util.hexstrdump(keyList[0].obj.getKeyId()).substring(8);
    var user = keyList[0].obj.userIds[0].text;
    var pubkeyAlgo = this.getAlgorithmType(signature.publicKeyAlgorithm);
    var result = false;

    // console.log(this._infoDiv.msg[0].text);
    // console.log(util.hexdump(this._infoDiv.msg[0].text));

    for (var i = 0 ; i < keyList.length; i++) {
        if (signature.verify(this._infoDiv.msg[0].text, keyList[i])) {
            user = keyList[i].obj.userIds[0].text;
            id = "0x" + util.hexstrdump(keyList[i].obj.getKeyId()).substring(8);
            result = true;
            break;
        }
    }

    // Successful verification! yay!
    this.resultBar(result, id, user, pubkeyAlgo);
};

/*
===== This is the function responsible for the drawing of the manual key entry stuff =====
*/
Com_Zimbra_PGP.prototype.manualKeyEntry = function() {
    this._dialog.popdown();
    HTML = '<div id="keyEntryDiv">' +
	           '<textarea id="keyEntryTextarea"></textarea>' +
	       '</div>';

    var sDialogTitle = "<center>Enter in the public key and press \"OK\"</center>";

    this.pView = new DwtComposite(appCtxt.getShell());
    this.pView.setSize("500", "500"); 
    this.pView.getHtmlElement().style.overflow = "auto";
    this.pView.getHtmlElement().innerHTML = HTML;

    // pass the title, view & buttons information to create dialog box
    this._dialog = new ZmDialog({title:sDialogTitle, view:this.pView, parent:appCtxt.getShell(), standardButtons:[DwtDialog.OK_BUTTON]});
    this._dialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._readKeyListener)); 
    this._dialog.popup();
};

/*
===== This is function returns a text version of the public key algorithm =====
*/
Com_Zimbra_PGP.prototype.getAlgorithmType = function(algorithm) {
    var pubkeyAlgo = "UNKNOWN";

    switch (algorithm) {
        case 1:		// RSA (Encrypt or Sign)
        case 2:		// RSA Encrypt-Only
        case 3:		// RSA Sign-Only
            pubkeyAlgo = "RSA";
            break;
        case 17:	// DSA (Digital Signature Algorithm)
            pubkeyAlgo = "DSA";
            break;
    }

    return pubkeyAlgo;
}

/*
===== These change the infoBar stuff to pass/fail verification =====
*/
Com_Zimbra_PGP.prototype.resultBar = function(succeeded, id, user, type) {
    this._infoDiv = document.getElementById(appCtxt.getCurrentView()._mailMsgView._infoBarId);

    user = user.replace('<','&lt;').replace('>','&gt;');

    var values = {
        className: succeeded ? 'success' : 'fail',
        algo: type,
        id: id,
        user: user,
        msg: succeeded ? 'verified successfully!' : '*NOT* verified!'
    };

    var html = AjxTemplate.expand("com_zimbra_pgp.templates.pgp#infobar_result", values);

    document.getElementById('infoBarMsg').innerHTML = html;

    // Make the bar visible
    this._infoDiv.innerHTML = html;

    msgId = appCtxt.getCurrentView()._mailMsgView._msg.id
    this.storeInTempCache(msgId, html)
};

/*
===== Generic error handler, pass it a message and it displays all scary and everything =====
*/
Com_Zimbra_PGP.prototype.errDialog = function(msg){
        // Get refrence to our DWT object
        this._errDialog = appCtxt.getMsgDialog(); 
        // Set the style to critical
        var style = DwtMessageDialog.CRITICAL_STYLE;
        // Set the listener callback to just pop down the message
        this._errDialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._clrErrBtnListener));
        // Reset to a good state
        this._errDialog.reset();
        // Set our message to the one passed in and pop it up!
        this._errDialog.setMessage(msg,style);
        this._errDialog.popup();
};

/*
===== These are the button listeners =====
*/
Com_Zimbra_PGP.prototype._clrErrBtnListener = function(){
    // Pops down the _dialog refrence
    this._errDialog.popdown();
};

Com_Zimbra_PGP.prototype._clrBtnListener = function(){
    // Pops down the _dialog refrence
    this._dialog.popdown();
};

Com_Zimbra_PGP.prototype._readKeyListener = function(){
    this._infoDiv = document.getElementById(appCtxt.getCurrentView()._mailMsgView._infoBarId);
    this._dialog.popdown();
    // Get our key pasted in, and clear our the entry in the DOM
    var pgpKey = document.getElementById('keyEntryTextarea').value;
    document.getElementById('keyEntryTextarea').value = "";
    openpgp.keyring.importPublicKey(pgpKey);
};
