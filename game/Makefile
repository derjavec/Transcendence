CXX = c++
CXXFLAGS = -Wall -Wextra -Werror -IIncludes -g3 -std=c++98 

NAME = Game

FILES = $(addprefix src/, main.cpp TCPserver.cpp Game.cpp Ball.cpp)

OBJ = $(FILES:.cpp=.o)

%.o: %.cpp
	$(CXX) $(CXXFLAGS) -c $< -o $@

$(NAME): $(OBJ)
	$(CXX) $(CXXFLAGS) $(OBJ) -o $(NAME) -lsqlite3

all: $(NAME)

clean: 
	rm -rf $(OBJ)

fclean: clean
	rm -rf $(NAME)

re: fclean all

.PHONY: all, clean, fclean, re