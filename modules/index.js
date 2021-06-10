let User = syzoj.model('user');
let Article = syzoj.model('article');
let Contest = syzoj.model('contest');
let Problem = syzoj.model('problem');
let Judger = syzoj.model('judger')
let Divine = syzoj.lib('divine');
let JudgeState = syzoj.model('judge_state');
let TimeAgo = require('javascript-time-ago');
let zh = require('../libs/timeago');
TimeAgo.locale(zh);
const timeAgo = new TimeAgo('zh-CN');

app.get('/', async (req, res) => {
  try {
    var cpuStat = require('cpu-stat');
    let ranklist = await User.queryRange([1, syzoj.config.page.ranklist_index], { is_show: true }, {
      [syzoj.config.sorting.ranklist.field]: syzoj.config.sorting.ranklist.order
    });
    await ranklist.forEachAsync(async x => x.renderInformation());

    let notices = (await Article.find({
      where: { is_notice: true }, 
      order: { public_time: 'DESC' }
    })).map(article => ({
      title: article.title,
      url: syzoj.utils.makeUrl(['article', article.id]),
      date: syzoj.utils.formatDate(article.public_time, 'L')
    }));

    let fortune = null;
    if (res.locals.user) {
      fortune = Divine(res.locals.user.username, res.locals.user.sex);
    }

    let contests = await Contest.queryRange([1, 5], { is_public: true }, {
      start_time: 'DESC'
    });

    let countdown = syzoj.config.countdown; //倒计时配置
    let moment = require("moment"); 
    let now = moment(), count_time = moment(countdown.date);
    countdown.days = count_time.diff(now, 'day'); //计算倒计时天数

    let problems = (await Problem.queryRange([1, 5], { is_public: true }, {
      publicize_time: 'DESC'
    })).map(problem => ({
      id: problem.id,
      title: problem.title,
      time: timeAgo.format(new Date(problem.publicize_time)),
    }));
    var cpuStat = require('cpu-stat');
    var os = require('os');
    let tmp=await JudgeState.find({
      where:{
        status:"Waiting"
      }
    })

    let judgers = await Judger.find()

    await cpuStat.usagePercent(function(err, percent, seconds) {
      if (err) {
          return console.log(err);
      }
      let mem_total = os.totalmem(),
      mem_free = os.freemem(),
      mem_used = mem_total - mem_free,
      mem_ratio = 0;
      mem_total = (mem_total / (1024 * 1024 * 1024));
      mem_used = (mem_used / (1024 * 1024 * 1024));
      mem_ratio = mem_used / mem_total * 100;
      res.render('index', {
        countdown: countdown,
        ranklist: ranklist,
        notices: notices,
        fortune: fortune,
        contests: contests,
        problems: problems,
        links: syzoj.config.links,
        judgers: judgers,
        message: `CPU使用率：${percent.toFixed(2)}%<br>内存使用率：${mem_ratio.toFixed(2)}%<br>评测队列大小：${tmp.length}`
      });
    });
    
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});

app.get('/help', async (req, res) => {
  try {
    res.render('help');
  } catch (e) {
    syzoj.log(e);
    res.render('error', {
      err: e
    });
  }
});
