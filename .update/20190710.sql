alter table contest add column visitable varchar(200); -- 增加比赛的看见用户功能
alter table user add column groups varchar(1); -- 增加用户的分组功能
alter table user add column simple_name varchar(5); -- 增加用户姓名首字母
