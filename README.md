<pre>
 ::::::::::..     .,-::::::::::::-.         ....:::::: .::::::. 
 ;;;;;;;``;;;;  ,;;;'````' ;;,   `';,    ;;;;;;;;;````;;;`    ` 
 [[[ [[[,/[[['  [[[        `[[     [[    ''`  `[[.    '[==/[[[[,
 $$$ $$$$$$c    $$$         $$,    $$   ,,,    `$$      '''    $
 888 888b "88bo,`88bo,__,o, 888_,o8P'd8b888boood88     88b    dP
 MMM MMMM   "W"   "YUMMMMMP"MMMMP"`  YMP"MMMMMMMM"      "YMmMY" 

                                            A Node.JS IRC Server
 ircd.js
</pre>
## IRCDjs-six
IRCDjs-six is a fork from the original owners git hub (I believe to be Alex Young): https://github.com/alexyoung/ircd.js


The reason I started this extension is to advance my NodeJS skills and overall javascript knowledge. Feel free to contribute and become a project developer. 


The readme has been updated. The original one can be found here: https://github.com/alexyoung/ircd.js/blob/master/README.textile


IRCD.js-six Dev

rambeau88 (kyle)

#### Done

* PASS (connection password)
* PING/PONG
* PRIVMSG
* MODE
* JOIN
* TOPIC
* NAMES
* LIST
* INVITE
* WHOWAS
* TIME
* VERSION
* AWAY
* WHO
* OPER
* KICK
* CONNECT
* OWNERKEY
* SERVICE
* LUSERS
* NOTICE
* ADMIN
* INFO
* STATS: C, U
* Channel modes: A, P, a, o, p, s, t, r, n, m, i, l, b, v, k
* User modes: O, S, A, N, X, a, i, w, o, s
* Prefix: &Service ~Oper @Owner %Host +Voice

#### Oper Levels
* 0 - uMode O - Local oper
* 1 - uMode S - Support
* 2 - uMode o - Operator
* 3 - uMode A - Admin
* 4 - uMode N - Network Admin
* 5 - uMode X - Full Admin


#### Oper Commands
* REHASH         (5+)
* KILL           (3+)
* WALLUSERS      (2+)
* WALLOPS        (2+)


#### In Progress:

* Services
* Server Links
* Server-to-server NICK messages when nicks are changed or new clients join
* Server-to-server messages for JOIN, NJOIN, MODE, PRIVMSG and NOTICE
* SQUIT and QUIT for links
* Server to server communication
* More basic commands: LINKS, TRACE
* Log files and logging options
* Local ops (+O)

#### Documentation

There is no documentation of this version.

#### Contributions

* overra
* jazzychad (Chad Etzel)
* sespindola (Sebastian A. Espindola)
* niklasf
* treeform
* guybrush (Patrick Pfeiffer)
* eirikb (Eirik Brandtzæg)
* andrew12 (Andrew Herbig)
* jrasanen (Jussi Räsänen)

#### License (GPL)

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see "http://www.gnu.org/licenses/":http://www.gnu.org/licenses/.
