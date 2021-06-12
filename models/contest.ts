import * as TypeORM from "typeorm";
import Model from "./common";
import * as request from "request-promise";

declare var syzoj, ErrorMessage: any;

import User from "./user";
import Problem from "./problem";
import ContestRanklist from "./contest_ranklist";
import ContestPlayer from "./contest_player";

enum ContestType {
  NOI = "noi",
  IOI = "ioi",
  ICPC = "acm"
}


@TypeORM.Entity()
export default class Contest extends Model {
  static cache = true;

  @TypeORM.PrimaryGeneratedColumn()
  id: number;

  @TypeORM.Column({ nullable: true, type: "varchar", length: 80 })
  title: string;

  @TypeORM.Column({ nullable: true, type: "text" })
  subtitle: string;

  @TypeORM.Column({ nullable: true, type: "integer" })
  start_time: number;

  @TypeORM.Column({ nullable: true, type: "integer" })
  end_time: number;

  @TypeORM.Index()
  @TypeORM.Column({ nullable: true, type: "integer" })
  holder_id: number;

  // type: noi, ioi, acm
  @TypeORM.Column({ nullable: true, type: "enum", enum: ContestType })
  type: ContestType;

  @TypeORM.Column({ nullable: true, type: "text" })
  information: string;

  @TypeORM.Column({ nullable: true, type: "text" })
  after_information: string;

  @TypeORM.Column({ nullable: true, type: "text" })
  problems: string;

  @TypeORM.Column({ nullable: true, type: "text" })
  admins: string;

  @TypeORM.Index()
  @TypeORM.Column({ nullable: true, type: "integer" })
  ranklist_id: number;

  @TypeORM.Index()
  @TypeORM.Column({ nullable: true, type: "integer" })
  after_ranklist_id: number;

  @TypeORM.Column({ nullable: true, type: "boolean" })
  is_public: boolean;

  @TypeORM.Column({ nullable: true, type: "boolean" })
  hide_statistics: boolean;

  @TypeORM.Column({ nullable: true, type: "text" })
  password: string;

  @TypeORM.Column({ default: false, type: "boolean" })
  rated: boolean;

  holder?: User;
  ranklist?: ContestRanklist;
  after_ranklist?: ContestRanklist;

  async loadRelationships() {
    this.holder = await User.findById(this.holder_id);
    this.ranklist = await ContestRanklist.findById(this.ranklist_id);
    this.after_ranklist = await ContestRanklist.findById(this.after_ranklist_id);
  }

  async isSupervisior(user) {
    return user && (user.is_admin || this.holder_id === user.id || this.admins.split('|').includes(user.id.toString()));
  }

  allowedSeeingOthers() {
    if (this.type === 'acm' || this.type === "ioi") return true;
    else return false;
  }

  allowedSeeingScore() { // If not, then the user can only see status
    if (this.type === 'ioi') return true;
    else return false;
  }

  allowedSeeingResult() { // If not, then the user can only see compile progress
    if (this.type === 'ioi' || this.type === 'acm') return true;
    else return false;
  }

  allowedSeeingTestcase() {
    if (this.type === 'ioi') return true;
    return false;
  }

  getStaticRanklistPath() {
    return syzoj.utils.resolvePath(syzoj.config.upload_dir, 'contest_file', this.id.toString(), 'static.html');
  }

  getXmlRanklistPath() {
    return syzoj.utils.resolvePath(syzoj.config.upload_dir, 'contest_file', this.id.toString(), 'static.xml');
  }

  getDataPath() {
    return syzoj.utils.resolvePath(syzoj.config.upload_dir, 'contest_file', this.id.toString());
  }
  async getProblems() {
    if (!this.problems) return [];
    return this.problems.split('|').map(x => parseInt(x));
  }

  async setProblemsNoCheck(problemIDs) {
    this.problems = problemIDs.join('|');
  }

  async setProblems(s) {
    let a = [];
    await s.split('|').forEachAsync(async x => {
      let problem = await Problem.findById(x);
      if (!problem) return;
      a.push(x);
    });
    this.problems = a.join('|');
  }

  async newSubmission(judge_state) {
    let problems = await this.getProblems();
    if (!problems.includes(judge_state.problem_id)) throw new ErrorMessage('当前比赛中无此题目。');

    await syzoj.utils.lock(['Contest::newSubmission', judge_state.user_id], async () => {
      let player = await ContestPlayer.findInContest({
        contest_id: this.id,
        user_id: judge_state.user_id,
        is_after: false
      });

      let player_after = await ContestPlayer.findInContest({
        contest_id: this.id,
        user_id: judge_state.user_id,
        is_after: true
      });

      if (!player) {
        player = await ContestPlayer.create({
          contest_id: this.id,
          user_id: judge_state.user_id,
          is_after: false
        });
        player_after = await ContestPlayer.create({
          contest_id: this.id,
          user_id: judge_state.user_id,
          is_after: true
        });
        await player.save();
        await player_after.save();
      }


      await this.loadRelationships();

      if (!this.after_ranklist) {
        this.after_ranklist = await ContestRanklist.create();
        this.after_ranklist.ranking_params = this.ranklist.ranking_params;
        await this.after_ranklist.save();
        this.after_ranklist_id = this.after_ranklist.id;
        await this.save();
      }

      if (judge_state.submit_time >= this.start_time && judge_state.submit_time <= this.end_time) {
        await player.updateScore(judge_state);
        await player.save();
        await this.ranklist.updatePlayer(this, player);
      }

      await player_after.updateScore(judge_state);
      await player_after.save();
      await this.after_ranklist.updatePlayer(this, player_after);

      await this.ranklist.save();
      await this.after_ranklist.save();
    });
  }

  isRunning(now?) {
    if (!now) now = syzoj.utils.getCurrentDate();
    return now >= this.start_time && now < this.end_time;
  }

  isEnded(now?) {
    if (!now) now = syzoj.utils.getCurrentDate();
    return now >= this.end_time;
  }
}
