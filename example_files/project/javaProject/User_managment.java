package application;

import java.io.FileNotFoundException;
import java.io.IOException;

public interface User_managment {
    void addUser( User user );
   static boolean search ( String search_term ) throws FileNotFoundException, IOException{
	
	   return false;
   }
   static void editUser(User new_user,User old_user) throws FileNotFoundException, IOException{
	   
   }
    void removeUser(int pos, User u ) throws FileNotFoundException, IOException;
   

}
