## IRCDjs-six
[![Version npm](https://img.shields.io/npm/v/ircdjs-six.svg?style=flat-square)](https://www.npmjs.com/package/ircdjs-six)[![npm Downloads](https://img.shields.io/npm/dm/ircdjs-six.svg?style=flat-square)](https://www.npmjs.com/package/ircdjs-six)[![Build Status](https://img.shields.io/travis/rambeau88/ircdjs-six/master.svg?style=flat-square)](https://travis-ci.org/rambeau88/ircdjs-six)[![Dependencies](https://img.shields.io/david/rambeau88/ircdjs-six.svg?style=flat-square)](https://david-dm.org/rambeau88/ircdjs-six)

[![NPM](https://nodei.co/npm/ircdjs-six.png?downloads=true&downloadRank=true)](https://nodei.co/npm/ircdjs-six/)

IRCDjs-six is a "NodeJS":http://nodejs.org/ IRC Server extension of the orignal ircd.js project. The project will follow "RFC 1459":https://tools.ietf.org/html/rfc1459 / "RFC 2812":https://tools.ietf.org/html/rfc2812 to some extent. 


IRC servers were always fascinating to me and I always wished to take part in creating a cloud based irc server. I will go as far as I can with this project and try to make updates daily. Im a feedback lover so let me know your thoughts.  



IRCD.js-six Extension Developer

rambeau88


#### Documentation

There is no documentation of this version.

#### IRC Commands Completed

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
* STATS: C, M, U
* Channel modes: A,a,o,h,v | P,p,s,t,r,n,m,i,l,b,k
* User modes: O,S,A,N,X,a,i,w,o,s
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


#### Things to do next...

* Services
* Server Links
* Server-to-server NICK messages when nicks are changed or new clients join
* Server-to-server messages for JOIN, NJOIN, MODE, PRIVMSG and NOTICE
* SQUIT and QUIT for links
* Server to server communication
* More basic commands: LINKS, TRACE
* Log files and logging options
* Local ops (+O)

#### Contributions (ircd.js)

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
