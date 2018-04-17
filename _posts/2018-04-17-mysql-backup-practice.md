---
layout: default
title: "下厨房 MySQL 备份实践"
author: ushuz
tags:
  - ios
---

下厨房是国内最大的专注于家庭美食领域的社区，以菜谱和作品分享为核心，业务涉及电商、付费内容、短视频等，目前拥有超过 2000 万注册用户，全平台日活接近 300 万，用户上传了超过 100 万道菜谱、接近 4000 万个作品，赞和收藏量均接近 10 亿。

下厨房从创立已经走过 7 年时间，公司和业务都经历了很多的变化和成长，到现在仍然保持着一个精简的团队，用最务实的方案来支撑业务增长，借此机会和大家分享一些我们在 MySQL 备份方面的一些实践。


## 数据库架构概览

下厨房使用的是最常见的主备架构。

在迁移至云服务之前，我们使用 2 台物理机专门作为数据库机器，每台物理机上只运行 1 个 MySQL 实例，按业务划分 database，2 个实例互为主备。迁移至云服务后，对 database 按负载和业务可用性要求进行了分组。每组包括至少 2 个 MySQL 实例（每台云主机只运行 1 个实例）互为主备，分别放在不同的可用区，以减少因出现火灾、雷击等致命事故导致数据丢失的可能性。对于负载较大的分组，增设了若干只读实例，通过部分读写分离分担负载。

随着业务增长，我们的数据库规模也在不断增加，目前大概有 10 个主备对，总数据量近 2T，最大表有近 10 亿行，峰值数据库总 QPS 接近 15 万。

目前使用数据库的主要姿势有：
- SSD 硬盘
- Percona Server 5.6 / 5.7 + InnoDB
- Row-based Replication (RBR) + GTID
- 使用 Percona Toolkit 中的 pt-online-schema-change 进行在线 schema 变更
- 使用 Percona Monitoring and Management (PMM) 监控


## 冗余和备份

<!--
> 语录：冗余不做，日子甭过；备份不做，十恶不赦！
> - @delphij https://twitter.com/delphij/status/7436635741
 -->
<blockquote class="twitter-tweet" data-lang="zh-cn"><p lang="zh" dir="ltr">语录：冗余不做，日子甭过；备份不做，十恶不赦！</p>&mdash; 𝓧𝓲𝓷 𝓛𝓲 (@delphij) <a href="https://twitter.com/delphij/status/7436635741?ref_src=twsrc%5Etfw">2010年1月6日</a></blockquote>

下厨房对此深有体会。在 2013 年 6 月误删数据库文件后，由于冗余和备份中断长达 2 个月，不得不花费了大量时间精力从硬盘恢复数据。

冗余和备份是数据库管理工作的重中之重：一方面天有不测风云，从手抖删库到自然灾害，都可能导致数据库数据损失；另一方面数据是一家互联网公司最重要的资产，留得青山在，不怕没柴烧，但如果青山没了，恐怕就得散伙了。

有惨痛教训在前，我们对冗余和备份格外重视，以最大限度避免数据丢失。在实践中，Percona XtraBackup 和 JuiceFS 两款工具为我们带来了极大便利。

冗余方面，跨可用区主备架构提供了第一层保障，即使主节点数据库文件被误删、宿主机灭失、甚至所在可用区灭失，备节点也仍保有几乎全部数据。Percona XtraBackup 支持热备份，主节点无需停机，简单几步操作即可创建一个 slave，让架设主备变得得心应手。

```
# on master, take a backup to /backup/mysql
root@master $ juicefs mount <volume> /backup
root@master $ innobackupex --no-timestamp --slave-info /backup/mysql/

# on slave, copy back the backup
# before copying, shutdown mysql on slave
root@slave $ juicefs mount <volume> /backup
root@slave $ rsync -avP /backup/mysql/ /path/to/mysql/datadir

# prepare the backup
# it’s faster to apply logs on SSD than on a network filesystem (in our case JuiceFS)
root@slave $ innobackupex --apply-log --use-memory=16G /path/to/mysql/datadir

# make sure datadir ownership
# then start mysql on slave, setup replication based on /backup/mysql/xtrabackup_binlog_info
# if the backup was taken from a slave, use /backup/mysql/xtrabackup_slave_info
root@slave $ chown -R mysql:mysql /path/to/mysql/datadir
```

备份方面，每天定时备份整库及 binlog 提供了第二层保障，在第一层保障失效，如手抖误 DROP 时，仍能恢复全部数据。但是，整库备份体积较大，每日定时备份产生的数据量相当可观。JuiceFS 依托对象存储提供了近乎无限的存储空间，十分适合备份的场景，这样一来可以按需长期保留备份而不必过多担心空间占用。我们目前的策略是保留 7 天内的 Percona XtraBackup 整库备份、3 年内的 binlog 以及 1 年内的周级 mysqldump。

相比于自建 NFS，JuiceFS 是与对象存储同等级的高可用服务，它还可以实现跨云的数据冗余，便于跨地域甚至跨云传输。跨地域或跨云访问 JuiceFS 时是通过对象存储的公网出口来传输数据，带宽十分充足，我们曾在 AWS 北京从基于 UCloud UFile 的 JuiceFS 中拷贝数据，传输速度能达到 800+Mbps。


## 备份验证

<!--
> 终于明白为啥我们公司的数据库备份有检查大小的 alert 了
> - @inntran https://twitter.com/inntran/status/764480493681205248
 -->
<blockquote class="twitter-tweet" data-lang="zh-cn"><p lang="zh" dir="ltr">终于明白为啥我们公司的数据库备份有检查大小的 alert 了</p>&mdash; 荡师傅 (@inntran) <a href="https://twitter.com/inntran/status/764480493681205248?ref_src=twsrc%5Etfw">2016年8月13日</a></blockquote>

定时备份不意味着高枕无忧，因为备份也可能出问题，因此验证备份是十分必要的。检查备份的大小是一种最简单的方法，但对于数据库备份而言，备份是否真的可用，只有用备份进行一次恢复才知道。一次恢复成功的标志是：MySQL 进程启动且 replication 正常。

常规恢复流程中需要拷贝备份，对于体积较大的备份，拷贝过程会耗时很久，用于运行测试的目标机器也要有足够的硬盘空间，这样的话备份测试的时间成本相当高。

好在 JuiceFS 提供了快照（snapshot）功能，可以为 JuiceFS 上某个路径快速创建一份快照，对快照进行的修改不会影响原路径下的文件。利用 JuiceFS 的快照功能，可以节约大量时间成本。

下厨房基于 Docker 和 JuiceFS 快照构建了一套简单易用的备份测试方案：主要包括在云主机上运行的，执行创建快照、启动容器及清理快照的 verify-backup.sh，

```
#!/usr/bin/env bash
juicefs snapshot /backup/mysql /backup/snapshot

# run a percona:5.7 container to verify the backup
# make sure container can reach master with --add-host or --network
docker run --rm \
    -v /path/to/my-cnf:/root/.my.cnf:ro \
    -v /path/to/report.sh:/report.sh:ro \
    -v /backup/snapshot:/var/lib/mysql \
    percona:5.7 \
    /report.sh

juicefs snapshot -d /backup/snapshot
```

以及在容器中运行的，执行准备备份、配置 replication 并报告 replication 状态的 report.sh。

```
#!/usr/bin/env bash
set -e

# switch to domestic mirrors
sed -i 's|deb.debian.org/debian|ftp.cn.debian.org/debian|g' /etc/apt/sources.list
sed -i 's|security.debian.org|ftp.cn.debian.org/debian-security|g' /etc/apt/sources.list

# install percona-xtrabackup-24
apt-get update && apt-get install -y percona-xtrabackup-24

# prepare backup
innobackupex --apply-log --use-memory=16G /var/lib/mysql > /dev/null
chown -R mysql:mysql /var/lib/mysql

# start mysql
mysqld \
  --default-storage-engine=InnoDB \
  --character-set-server=utf8mb4 \
  --collation-server=utf8mb4_unicode_ci \
  --server-id=1234 \
  --gtid-mode=on \
  --enforce-gtid-consistency=on \
  --read-only=on \
  --transaction-isolation=READ-COMMITTED \
  --binlog-format=ROW \
  --master-info-repository=TABLE \
  --relay-log-info-repository=TABLE \
  --log-bin=/var/log/mysql/mysql-bin \
  --relay-log=mysqld-relay-bin \
  --log-error=/var/log/mysql/error.log \
  --innodb-lru-scan-depth=256 \
  --disable-partition-engine-check &

# check mysql ready, timeout 300s
# it seems that commands inside loop aren't affected by "set -e"
n=0
until [ $n -ge 100 ]; do
  mysqladmin ping && break
  n=$[$n+1]
  sleep 3
done

# setup gtid, connect to mysql server using /root/.my.cnf to avoid password input
mysql < <(printf "RESET SLAVE;\nRESET MASTER;\n$(cat /var/lib/mysql/xtrabackup_slave_info);\nSTART SLAVE;\n")

# check replication status
#   Slave_IO_Running / Slave_SQL_Running should be Yes
#   Seconds_Behind_Master should be reasonable
sleep 10
mysql -e 'SHOW SLAVE STATUS\G' | grep -E '(Running:|Seconds)'

# report and exit
exit $?
```

在备份完成后，通过定时任务，或其他方式触发 verify-backup.sh 运行。如果备份验证成功，脚本应打印出 MySQL replication 线程的状态及落后于 master 的时间，replication 线程应都处于 Running 状态，且落后于 master 的时间应在合理范围内。

```
             Slave_IO_Running: Yes
            Slave_SQL_Running: Yes
        Seconds_Behind_Master: 3625
```

另外鉴于备份及备份验证任务的特殊性和重要性，需要额外关注下通知策略。如果只在报错时通知，那当没有收到通知时可能是任务运行成功，也可能是任务根本没有运行。对于备份及备份验证任务而言，没有运行也算任务失败。


## 总结

下厨房是一家小公司，技术资源较为有限。借助 Percona 全家桶及 JuiceFS，我们快速地实现了数据库冗余和备份，以及一套简单易用的备份验证方案，从而使我们可以更加专注且有信心地推进业务开发，助力业务增长。

接下来在数据库方面，我们还将继续探索快速主备切换、延时复制、跨地域或云服务冗余、NewSQL 等。如果你也对这些方面有兴趣，欢迎[加入下厨房][1]一起探索。


[1]: https://www.xiachufang.com/job/
{:target="_blank"}
