interface UsersObject {
  users: TwitterUser[]
}

type ScrapedUsersIterator = AsyncIterableIterator<Either<Error, UsersObject>>
