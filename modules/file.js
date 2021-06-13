const { file } = require('tmp-promise');

let User = syzoj.model('user');
let File = syzoj.model('file');

function downloadOrRedirect(req, res, filename, sendName) {
  if (syzoj.config.site_for_download) {
    res.redirect(syzoj.config.site_for_download + syzoj.utils.makeUrl(['api', 'v2', 'download', jwt.sign({
      filename: filename,
      sendName: sendName,
      originUrl: syzoj.utils.getCurrentLocation(req)
    }, syzoj.config.session_secret, {
      expiresIn: '2m'
    })]));
  } else {
    console.log(filename);
    res.download(filename, sendName);
  }
}

 function Encrypt(str, pwd) {
        if (str == "") return "";
        str = escape(str);
        if (!pwd || pwd == "") { var pwd = "1234"; }
        pwd = escape(pwd);
        if (pwd == null || pwd.length <= 0) {
            alert("Please enter a password with which to encrypt the message.");
            return null;
        }
        var prand = "";
        for (var I = 0; I < pwd.length; I++) {
            prand += pwd.charCodeAt(I).toString();
        }
        var sPos = Math.floor(prand.length / 5);
        var mult = parseInt(prand.charAt(sPos) + prand.charAt(sPos * 2) + prand.charAt(sPos * 3) + prand.charAt(sPos * 4) + prand.charAt(sPos * 5));
        var incr = Math.ceil(pwd.length / 2);
        var modu = Math.pow(2, 31) - 1;
        if (mult < 2) {
            alert("Algorithm cannot find a suitable hash. Please choose a different password. /n Possible considerations are to choose a more complex or longer password.");
            return null;
        }
        var salt = Math.round(Math.random() * 1000000000) % 100000000;
        prand += salt;
        while (prand.length > 10) {
            prand = (parseInt(prand.substring(0, 10)) + parseInt(prand.substring(10, prand.length))).toString();
        }
        prand = (mult * prand + incr) % modu;
        var enc_chr = "";
        var enc_str = "";
        for (var I = 0; I < str.length; I++) {
            enc_chr = parseInt(str.charCodeAt(I) ^ Math.floor((prand / modu) * 255));
            if (enc_chr < 16) {
                enc_str += "0" + enc_chr.toString(16);
            } else
                enc_str += enc_chr.toString(16);
            prand = (mult * prand + incr) % modu;
        }
        salt = salt.toString(16);
        while (salt.length < 8) salt = "0" + salt;
        enc_str += salt;
        return enc_str;
    }



//---------------------------------------------解密函数

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

app.get('/files',async (req,res)=>{
    try{
        let user = await User.findById(res.locals.user.id);
        if(!user)throw new ErrorMessage("请先登录！");
        await user.loadRelationships();
        const re = await user.listFile()
        res.render('file',{
            files: re ? re.files : []
        })
    }catch(e){
        res.render('error', {
            err: e
        });
    }
})

app.post('/file/upload', app.multer.array('file'), async (req, res) => {
  try {
    let user = await User.findById(res.locals.user.id);
    if(!user)throw new ErrorMessage("请先登录！");

    if (req.files) {
      for (let file of req.files) {
        await user.uploadSingleFile(file.originalname, file.path, file.size, await res.locals.user.hasPrivilege('manage_problem'));
      }
    }
    res.redirect(syzoj.utils.makeUrl(['files']));
  } catch (e) {
    syzoj.log(e);
    res.render('error',{
        err:e
    })
  }
});

app.post('/file/delete/:filename', async (req, res) => {
  try {
    let user = await User.findById(res.locals.user.id);
    if(!user)throw new ErrorMessage("请先登录！");
    
    await user.deleteSingleFile(req.params.filename);
    res.redirect(syzoj.utils.makeUrl(['files']));
  } catch (e) {
    syzoj.log(e);
    res.render('error',{
        err:e
    })
  }
});

app.get('/file/download/:filename?', async (req, res) => {
  try {
    let user = await User.findById(res.locals.user.id);
    if(!user)throw new ErrorMessage("请先登录！");

    if (typeof req.params.filename === 'string' && (req.params.filename.includes('../'))) throw new ErrorMessage('您没有权限进行此操作。)');


    let path = require('path');
    let filename = path.join(user.getFilePath(), req.params.filename);
    if (!await syzoj.utils.isFile(filename)) throw new ErrorMessage('文件不存在。');

    downloadOrRedirect(req, res, filename, path.basename(filename));
  } catch (e) {
    syzoj.log(e);
    res.status(404);
    res.render('error', {
      err: e
    });
  }
});

app.get('/file/share/:filename?', async (req, res) => {
  try {
    let user = await User.findById(res.locals.user.id);
    if(!user)throw new ErrorMessage("请先登录！");

    if (typeof req.params.filename === 'string' && (req.params.filename.includes('../'))) throw new ErrorMessage('您没有权限进行此操作。)');


    let path = require('path');
    let filename = path.join(user.getFilePath(), req.params.filename);
    if (!await syzoj.utils.isFile(filename)) throw new ErrorMessage('文件不存在。');

    res.render('success',{
        message: `分享成功，链接为 http://47.92.197.167:5283/file/download-share/${Encrypt(filename,"dsfz")}`
    })
  } catch (e) {
    syzoj.log(e);
    res.status(404);
    res.render('error', {
      err: e
    });
  }
});


app.get('/file/download-share/:mask?', async (req, res) => {
  try {
    let path = require('path');
    let filename = Decrypt(req.params.mask,"dsfz");
    console.log(filename)
    if (!await syzoj.utils.isFile(filename)) throw new ErrorMessage('文件不存在。');

    downloadOrRedirect(req, res, filename, path.basename(filename));
  } catch (e) {
    syzoj.log(e);
    res.status(404);
    res.render('error', {
      err: e
    });
  }
});