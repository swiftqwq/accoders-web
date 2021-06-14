 function Decrypt(str, pwd) {
        if (str == "") return "";
        if (!pwd || pwd == "") { var pwd = "1234"; }
        pwd = escape(pwd);
        if (str == null || str.length < 8) {
            alert("A salt value could not be extracted from the encrypted message because it's length is too short. The message cannot be decrypted.");
            return;
        }
        if (pwd == null || pwd.length <= 0) {
            alert("Please enter a password with which to decrypt the message.");
            return;
        }
        var prand = "";
        for (var I = 0; I < pwd.length; I++) {
            prand += pwd.charCodeAt(I).toString();
        }
        var sPos = Math.floor(prand.length / 5);
        var mult = parseInt(prand.charAt(sPos) + prand.charAt(sPos * 2) + prand.charAt(sPos * 3) + prand.charAt(sPos * 4) + prand.charAt(sPos * 5));
        var incr = Math.round(pwd.length / 2);
        var modu = Math.pow(2, 31) - 1;
        var salt = parseInt(str.substring(str.length - 8, str.length), 16);
        str = str.substring(0, str.length - 8);
        prand += salt;
        while (prand.length > 10) {
            prand = (parseInt(prand.substring(0, 10)) + parseInt(prand.substring(10, prand.length))).toString();
        }
        prand = (mult * prand + incr) % modu;
        var enc_chr = "";
        var enc_str = "";
        for (var I = 0; I < str.length; I += 2) {
            enc_chr = parseInt(parseInt(str.substring(I, I + 2), 16) ^ Math.floor((prand / modu) * 255));
            enc_str += String.fromCharCode(enc_chr);
            prand = (mult * prand + incr) % modu;
        }
        return unescape(enc_str);
    }
console.log(Decrypt("",require("../config.json").session_secret))