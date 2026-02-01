10 REM ************* BOMBER by DAVE TOWN *************
20 REM ************* Initialise *************
30 MODE 1:CLS:INK 0,0:BORDER 0:INK 1,18:INK 2,6:INK 3,4:INK 5,15:INK 6,2:INK 7,24:INK 8,8:INK 9,26:INK 10,10:INK 11,20:INK 12,12:INK 13,16:INK 14,14:INK 15,21
40 SYMBOL AFTER 240:SYMBOL 241,&40,&60,&70,&7F,&7F,&3F,&7,&0:SYMBOL 242,&0,&32,&7A,&FE,&FA,&F2,&E0,&0
50 score=0:plane$=CHR$(241)+CHR$(242):x=2:y=2:drop=0:a=2:b=2
60 ON ERROR GOTO 80
70 GOSUB 570: GOSUB 810
80 CLS:PEN 2
90 a$=INKEY$
100 IF a$=CHR$(11) OR a$=CHR$(240) THEN skill=skill+1
110 IF a$=CHR$(10) OR a$=CHR$(241) THEN skill=skill-1
120 IF skill<0 THEN skill=5
130 IF skill>5 THEN skill=0
140 LOCATE 1,15: PRINT"Skill : 0 (ACE) to 5 (NOVICE)"; skill
150 IF a$=CHR$(13) THEN GOTO 170
160 IF a$=CHR$(88) OR a$=CHR$(32) THEN GOTO 200 ELSE GOTO 90
170 LOCATE 31,15:INPUT skill
180 IF skill<0 OR skill>5 THEN GOTO 170
190 LOCATE 1,15: PRINT CHR$(18)
200 skill=skill+10
210 a$=INKEY$
220 IF a$=CHR$(11) OR a$=CHR$(240) THEN rate=rate+10
230 IF a$=CHR$(10) OR a$=CHR$(241) THEN rate=rate-10
240 IF rate<0 THEN rate=100
250 IF rate>100 THEN rate=0
260 LOCATE 1,15:PRINT "Speed 0 (FAST) to 100 (SLOW) ";rate
270 IF a$=CHR$(13) THEN GOTO 290
280 IF a$=CHR$(88) OR a$=CHR$(32) THEN GOTO 310 ELSE GOTO 210
290 LOCATE 31,15:INPUT rate
300 IF rate>100 OR rate<0 GOTO 290
310 REM************** Buildings *****************
320 MODE 0:FOR base=5 TO 15:FOR height=21 TO INT(RND(1)*8+skill) STEP-1:LOCATE base,height:PEN base-2:PRINT CHR$(143)+CHR$(8)+CHR$(11)+CHR$(244);:NEXT:NEXT
330 PLOT 0,20,4:DRAW 640,20,4
340 LOCATE 1,25:PEN 2:PRINT"SCORE";score;:LOCATE 13,25:PRINT"HI";hiscore;
350 REM************** Main Game *****************
360 LOCATE x-1,y:PRINT"   ";
370 PEN 1:LOCATE x,y:PRINT plane$;:PEN 2
380 IF y=21 AND x=15 THEN GOTO 400:ELSE GOTO 450
390 REM************** Landed ********************
400 FOR c=0 TO 1000:NEXT
410 score=score+100-(skill*2):skill=skill-1:x=2:y=2:a=2:b=2:drop=0
420 IF skill<10 THEN skill=10:rate=rate-20
430 IF rate<0 THEN rate=0
440 GOTO 310
450 FOR c=0 TO rate:NEXT
460 x=x+1
470 IF x=18 THEN LOCATE x-1,y:PRINT CHR$(18);:x=2:y=y+1:LOCATE x,y:PEN 1:PRINT plane$;:PEN 2
480 a$=INKEY$:IF a$=" " AND drop=0 OR a$="X" AND drop=0 THEN drop=1:b=y+2:a=x
490 IF y=21 THEN drop=0
500 IF drop=1 THEN LOCATE a,b:PRINT CHR$(252);:LOCATE a,b-1:PRINT" ";:b=b+1:IF b>21 THEN LOCATE a,b:PRINT" ";:LOCATE a,b-1:PRINT" ";:a=0:b=0:drop=0:SOUND 3,4000,10,12,0,0,10
510 ga=(a-0.5)*32:gb=400-(b*16):bomb=TEST(ga,gb)
520 IF bomb>0 THEN GOTO 720
530 gx=((x+1.5)*32):gy=408-(y*16):crash=TEST(gx,gy)
540 IF crash>0 THEN GOTO 640
550 GOTO 360
560 REM************** Instructions **************
570 LOCATE 1,2:PEN 1:PRINT"You are piloting an aircraft over a  des-erted city and must clear the buildings in order to land and refuel.  Your air- craft moves across  the screen from     left to right.";:PRINT
580 PRINT:PRINT"On reaching the right, the aircraft      returns to the  left A LINE FURTHER     DOWN.You have an unlimited supply of    bombs and you can drop them on the      buildings  below by pressing the        SPACE BAR or FIRE BUTTON.";:PRINT
590 PRINT:PRINT"Each time you land, the height of the    buildings or the speed of your aircraft increases.";:PRINT:PRINT:PRINT"ONCE YOU HAVE RELEASED A BOMB, YOU WILL NOT BE ABLE TO RELEASE ANOTHER UNTIL THEFIRST HAS EXPLODED!!!!";
600 PEN 2:LOCATE 1,24:PRINT:PRINT"Press any key to start.";
610 a$=INKEY$:IF a$="" GOTO 610
620 RETURN
630 REM************** Collision ****************
640 LOCATE x-1,y:PRINT CHR$(32)+CHR$(32)+CHR$(32)+CHR$(238)+CHR$(8)+CHR$(188)+CHR$(8);
650 FOR t=1 TO 10:SOUND 7,4000,5,15,0,0,5:PEN t:PRINT CHR$(238)+CHR$(8)+CHR$(188)+CHR$(8)+CHR$(32)+CHR$(8);:FOR tm=0 TO 50:NEXT:NEXT:PEN 2
660 CLS:LOCATE 1,5:PRINT"You scored";score;
670 IF score>hiscore THEN hiscore=score:GOSUB 770:LOCATE 1,8:PRINT"TOP SCORE!!";
680 score=0:LOCATE 1,12:PRINT"Press SPACE or FIRE to restart";
690 a$=INKEY$:IF a$=CHR$(88) OR a$=CHR$(32) THEN GOTO 700 ELSE GOTO 690
700 PEN 1:MODE 1:x=2:y=2:a=2:b=2:GOTO 90
710 REM************** Bombed Building **********
720 LOCATE a,b-1:PRINT" "+CHR$(8);:PEN 4:FOR tr=1 TO INT(RND(1)*3)+1:score=score+5:SOUND 3,4000,10,12,0,0,10:LOCATE a,b:FOR t=0 TO 4:PRINT CHR$(238)+CHR$(8)+CHR$(32)+CHR$(8);:NEXT:b=b+1
730 IF b=24 THEN b=b-1
740 NEXT
750 LOCATE 6,25:PRINT score;:drop=0:a=x:b=y:GOTO 360
760 REM*************** Highscore ***************
770 OPENOUT "bomber.bak"
780 PRINT #9, hiscore
790 CLOSEOUT
800 RETURN
810 OPENIN "bomber.bak"
820 INPUT #9, hiscore
830 CLOSEIN
840 RETURN
