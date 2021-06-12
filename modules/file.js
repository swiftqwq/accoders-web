let User = syzoj.model('user');
let File = syzoj.model('file');

app.get('/files',async (req,res)=>{
    try{
        let user = await User.findById(res.locals.user.id);
        if(!user)throw new ErrorMessage("请先登录！");
        await user.loadRelationships();
        res.render('file',{
            files: user.upload_files
        })
    }catch(e){
        res.render('error', {
            err: e
        });
    }
})