let User = syzoj.model('user');
const RatingCalculation = syzoj.model('rating_calculation');
const RatingHistory = syzoj.model('rating_history');
const Contest = syzoj.model('contest');
const ContestPlayer = syzoj.model('contest_player');
const Record = syzoj.model('record');
let Article = syzoj.model('article');

function isOJ(domain){
  return domain=="m.akcoders.cf"||domain=="47.92.197.167"||domain=="oj.zhangyiming.tech";
}
app.get('/user_is_banned',async(req,res)=>{
  res.render('user_is_banned');
});

// Ranklist
app.get('/ranklist', async (req, res) => {
  try {
    const sort = req.query.sort || syzoj.config.sorting.ranklist.field;
    const order = req.query.order || syzoj.config.sorting.ranklist.order;
    if (!['ac_num', 'rating', 'id', 'username'].includes(sort) || !['asc', 'desc'].includes(order)) {
      throw new ErrorMessage('错误的排序参数。');
    }
    let paginate = syzoj.utils.paginate(await User.countForPagination({ is_show: true }), req.query.page, syzoj.config.page.ranklist);
    let ranklist = await User.queryPage(paginate, { is_show: true }, { [sort]: order.toUpperCase() });
    await ranklist.forEachAsync(async x => x.renderInformation());

    res.render('ranklist', {
      ranklist: ranklist,
      paginate: paginate,
      curSort: sort,
      curOrder: order === 'asc'
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/find_user', async (req, res) => {
  try {
    let user = await User.fromName(req.query.nickname);
    if (!user) throw new ErrorMessage('无此用户。');
    res.redirect(syzoj.utils.makeUrl(['user', user.id]));
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

// Login
app.get('/login', async (req, res) => {
  if (res.locals.user) {
    res.render('error', {
      err: new ErrorMessage('您已经登录了，请先注销。', { '注销': syzoj.utils.makeUrl(['logout'], { 'url': req.originalUrl }) })
    });
  } else {
    res.render('login');
  }
});

// Sign up
app.get('/sign_up', async (req, res) => {
  if (res.locals.user) {
    res.render('error', {
      err: new ErrorMessage('您已经登录了，请先注销。', { '注销': syzoj.utils.makeUrl(['logout'], { 'url': req.originalUrl }) })
    });
  } else {
    res.render('sign_up');
  }
});

// Logout
app.post('/logout', async (req, res) => {
  req.session.user_id = null;
  res.clearCookie('login');
  res.redirect(req.query.url || '/');
});

// User page
app.get('/user/:id', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');
    user.ac_problems = await user.getACProblems();
    user.articles = await user.getArticles();
    user.allowedEdit = await user.isAllowedEditBy(res.locals.user);

    let statistics = await user.getStatistics();
    await user.renderInformation();
    user.emailVisible = user.public_email || user.allowedEdit;
    const records = await Record.find({
      where:{user_id:user.id}
    });
    const ratingHistoryValues = await RatingHistory.find({
      where: { user_id: user.id },
      order: { rating_calculation_id: 'ASC' }
    });
    const ratingHistories = [{
      contestName: "初始积分",
      value: syzoj.config.default.user.rating,
      delta: null,
      rank: null
    }];

    for (const history of ratingHistoryValues) {
      var contest=undefined;
      const tmp=await RatingCalculation.findById(history.rating_calculation_id);
      if(tmp){
        contest = await Contest.findById(tmp.contest_id);
      }
      if(!contest){
        ratingHistories.push({
          contestName: "I'm Feeling Lucky!",
          value: history.rating_after,
          delta: history.rating_after - ratingHistories[ratingHistories.length - 1].value,
          rank: history.rank,
          participants: 0
        });
      }
      else{
        ratingHistories.push({
          contestName: contest.title,
          value: history.rating_after,
          delta: history.rating_after - ratingHistories[ratingHistories.length - 1].value,
          rank: history.rank,
          participants: await ContestPlayer.count({ contest_id: contest.id })
        });
      }
    }
    ratingHistories.reverse();

    res.render('user', {
      show_user: user,
      statistics: statistics,
      ratingHistories: ratingHistories,
      records:records
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/user/:id/delete', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');
    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }
    user.destroy();
    res.render('success', {
      success:true
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});
app.get('/user/:id/edit', async (req, res) => {
  try {
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) {
      throw new ErrorMessage('您没有权限进行此操作。');
    }

    user.privileges = await user.getPrivileges();

    res.locals.user.allowedManage = await res.locals.user.hasPrivilege('manage_user');

    res.render('user_edit', {
      edited_user: user,
      error_info: null
    });
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/forget', async (req, res) => {
  res.render('forget');
});
function setLoginCookie(username, password, res) {
  res.cookie('login', JSON.stringify([username, password]), { maxAge: 10 * 365 * 24 * 60 * 60 * 1000 });
}
app.get('/login_with_github',async (req, res) => {
    let path = 'https://github.com/login/oauth/access_token';
    const params = {
        client_id: 'b51dff5bdac07cad2c46',
        client_secret: 'd4c4eb2c97e356f2f374ef2c9ed183070539b6f7',
        code: req.query.code
    }
    let request = require('request-promise');
    let url = require('url');

    let tmp = await request({
      uri: (path+'?client_id=b51dff5bdac07cad2c46&client_secret=d4c4eb2c97e356f2f374ef2c9ed183070539b6f7&code='+req.query.code),
      timeout: 1500
    });
    const args = tmp.split('&');
    let arg = args[0].split('=');
    const access_token = arg[1];
    console.log(access_token);
    let json = await request({
      uri: 'https://api.github.com/user/emails',
      qs: {
          access_token: access_token
      },
      timeout: 100000,
      headers: {
        'Authorization': ' token '+access_token,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'swift-zym'
      },
      json:true
    });
    console.log(json);
    let email=undefined;
    for(let tmp of json){
      if(tmp.primary){
        email=tmp.email;
      }
    }
    let user = await User.fromEmail(email);
    if (!user){
      res.render('error', {
        err: "用户不存在！"
      });
    }
    else{
      req.session.user_id = user.id;
      setLoginCookie(user.username, user.password, res);
      res.render('return', {
        success: true
      });
    }
});


app.post('/user/:id/edit', async (req, res) => {
  let user;
  try {
    let id = parseInt(req.params.id);
    user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');

    let allowedEdit = await user.isAllowedEditBy(res.locals.user);
    if (!allowedEdit) throw new ErrorMessage('您没有权限进行此操作。');

    if (req.body.old_password && req.body.new_password) {
      if (user.password !== req.body.old_password && !await res.locals.user.hasPrivilege('manage_user')) throw new ErrorMessage('旧密码错误。');
      user.password = req.body.new_password;
    }

    if (res.locals.user && await res.locals.user.hasPrivilege('manage_user')) {
      if (!syzoj.utils.isValidUsername(req.body.username)) throw new ErrorMessage('无效的用户名。');
      user.username = req.body.username;
      user.email = req.body.email;
    }

    if (res.locals.user && res.locals.user.is_admin) {
      if (!req.body.privileges) {
        req.body.privileges = [];
      } else if (!Array.isArray(req.body.privileges)) {
        req.body.privileges = [req.body.privileges];
      }

      let privileges = req.body.privileges;
      await user.setPrivileges(privileges);
    }

    user.information = req.body.information;
    user.sex = req.body.sex;
    user.public_email = (req.body.public_email === 'on');
    user.prefer_dark_mode = (req.body.prefer_dark_mode === 'on');

    await user.save();

    if (user.id === res.locals.user.id) res.locals.user = user;

    user.privileges = await user.getPrivileges();
    res.locals.user.allowedManage = await res.locals.user.hasPrivilege('manage_user');

    res.render('user_edit', {
      edited_user: user,
      error_info: ''
    });
  } catch (e) {
    user.privileges = await user.getPrivileges();
    res.locals.user.allowedManage = await res.locals.user.hasPrivilege('manage_user');

    res.render('user_edit', {
      edited_user: user,
      error_info: e.message
    });
  }
});

app.get('/user/:id/blog',async (req,res)=>{
  try{
    let id = parseInt(req.params.id);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');
    let articles=await Article.find({
      where:{
        user_id:user.id
      }
    });
    articles.reverse();
    res.render('blog_index',{
      owner:user,
      articles:articles,
      isOJ:isOJ(req.host)
    });
  }catch(e){
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/user/:id/blog/:blogid',async(req,res)=>{
  try{
    let id = parseInt(req.params.id),blogid=parseInt(req.params.blogid);
    let user = await User.findById(id);
    if (!user) throw new ErrorMessage('无此用户。');
    let article=await Article.findById(blogid);
    // article.content = await syzoj.utils.markdown(article.content);
    let markdowner = require('markdown-it');
    var hljs = require('highlight.js');
    var md = new markdowner({
      html: true,
      highlight: function (str, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return '<pre class="hljs"><code>' + hljs.highlight(lang, str).value + '</code></pre>';
          } catch (__) {}
        }
        return '<pre class="hljs"><code>' + hljs.highlight('cpp', str).value + '</code></pre>'; // 使用额外的默认转义
      }
    });
    article.content=md.render(article.content);
    res.render('blog_view',{
      owner:user,
      article:article,
      isOJ:isOJ(req.host)
    });
  }catch(e){
    syzoj.log(e);
    res.render('error',{
      err: e
    });
  }
});